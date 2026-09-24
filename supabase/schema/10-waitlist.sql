-- The waitlist
--
-- Part of the schema. See supabase/README.md.

-- ---------------------------------------------------------------------------
-- Self-cancelling and the waitlist.
-- ---------------------------------------------------------------------------
alter table bookings add column if not exists token text unique;
alter table bookings add column if not exists promoted_at timestamptz;

create table if not exists waitlist (
  id          bigint generated always as identity primary key,
  session_id  text        not null,
  class_date  date        not null,
  name        text        not null,
  phone       text        not null,
  created_at  timestamptz not null default now(),
  promoted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- The waitlist carries who is waiting, the same way a booking does.
--
-- Without this, somebody who joined the queue as a member came off it as a
-- guest: promotion copies the row into bookings, and what it did not copy
-- was the membership. The desk would then ask a paying member to pay again.
-- ---------------------------------------------------------------------------
alter table public.waitlist
  add column if not exists member_id uuid references public.members (id) on delete set null;

alter table public.waitlist
  add column if not exists payment text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'waitlist_payment_check') then
    alter table public.waitlist
      add constraint waitlist_payment_check
      check (payment is null or payment in ('cash'));
  end if;
end;
$$;

-- One live entry per phone per slot, the same rule bookings follow.
-- The same split for the queue, for the same reason.
drop index if exists public.waitlist_live_unique;

create unique index if not exists waitlist_live_member_unique
  on public.waitlist (session_id, class_date, member_id)
  where promoted_at is null and member_id is not null;

create unique index if not exists waitlist_live_guest_unique
  on public.waitlist (session_id, class_date, phone)
  where promoted_at is null and member_id is null;

create index if not exists waitlist_date_idx on waitlist (class_date);

alter table waitlist enable row level security;

drop function if exists public.join_waitlist(text, date, text, text);

create or replace function join_waitlist(
  p_session_id text,
  p_class_date date,
  p_name       text,
  p_phone      text,
  p_member_id  uuid default null,
  p_payment    text default null
) returns json language plpgsql as $$
declare v_position int;
begin
  insert into waitlist (session_id, class_date, name, phone, member_id, payment)
  values (p_session_id, p_class_date, p_name, p_phone, p_member_id, p_payment);

  select count(*) into v_position from waitlist
   where session_id = p_session_id and class_date = p_class_date
     and promoted_at is null;

  return json_build_object('ok', true, 'position', v_position);
exception when unique_violation then
  return json_build_object('ok', false, 'position', 0);
end;
$$;

-- Runs the moment a place frees, so it takes the same advisory lock as
-- book_session - otherwise a promotion can race a member taking that place
-- and the class ends up one over capacity.
create or replace function promote_from_waitlist(
  p_session_id text, p_class_date date, p_capacity int
) returns json language plpgsql as $$
declare v_taken int; v_next waitlist%rowtype; v_token text; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id || p_class_date::text));

  select count(*) into v_taken from bookings
   where session_id = p_session_id and class_date = p_class_date
     and cancelled_at is null;
  if v_taken >= p_capacity then return null; end if;

  select * into v_next from waitlist
   where session_id = p_session_id and class_date = p_class_date
     and promoted_at is null
   order by created_at, id limit 1;
  if not found then return null; end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into bookings
    (session_id, class_date, name, phone, token, promoted_at, member_id, payment)
  values
    (p_session_id, p_class_date, v_next.name, v_next.phone, v_token, now(),
     v_next.member_id, v_next.payment)
  returning id into v_id;

  update waitlist set promoted_at = now() where id = v_next.id;

  return (select row_to_json(b) from bookings b where b.id = v_id);
exception when unique_violation then
  return null;
end;
$$;
