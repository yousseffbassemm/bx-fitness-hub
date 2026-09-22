-- BX Fitness Hub - class bookings
--
-- You only need this if you are deploying somewhere serverless, or running
-- more than one instance. On a single server the built-in SQLite store is
-- enough and needs no setup at all (see src/lib/store/sqlite.ts).
--
-- Run this once in the Supabase SQL editor, then set SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY. The app switches over on its own.

create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  session_id   text        not null,
  class_date   date        not null,
  name         text        not null,
  phone        text        not null,
  created_at   timestamptz not null default now(),
  -- Staff cancellation keeps the row and stamps this, so a member's record
  -- is never silently erased and the place is freed.
  cancelled_at timestamptz
);

-- Existing installs.
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings drop constraint if exists bookings_session_id_class_date_phone_key;

create index if not exists bookings_date_idx on public.bookings (class_date);

-- One place per phone per class, counting live rows only - otherwise someone
-- who was cancelled could never rebook.
create unique index if not exists bookings_live_unique
  on public.bookings (session_id, class_date, phone)
  where cancelled_at is null;

-- The table is only ever reached through the service role from the server,
-- so no anon policy is granted.
alter table public.bookings enable row level security;

-- Take a place, or report why not.
--
-- The advisory lock is what stops two people both taking the last place: it
-- serialises everyone booking the same class on the same date for the length
-- of the transaction.
create or replace function public.book_session(
  p_session_id text,
  p_date       date,
  p_name       text,
  p_phone      text,
  p_capacity   int
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  taken int;
begin
  perform pg_advisory_xact_lock(hashtext(p_session_id || '|' || p_date::text));

  select count(*) into taken
    from public.bookings
   where session_id = p_session_id
     and class_date = p_date
     and cancelled_at is null;

  if taken >= p_capacity then
    return json_build_object('ok', false, 'reason', 'full', 'spots_left', 0);
  end if;

  insert into public.bookings (session_id, class_date, name, phone)
  values (p_session_id, p_date, p_name, p_phone);

  return json_build_object('ok', true, 'spots_left', p_capacity - taken - 1);
exception
  when unique_violation then
    return json_build_object('ok', false, 'reason', 'duplicate');
end;
$$;

-- Undo a cancellation, if the class has not filled up since.
create or replace function public.restore_booking(
  p_id       uuid,
  p_capacity int
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  row_session text;
  row_date    date;
  taken       int;
begin
  select session_id, class_date into row_session, row_date
    from public.bookings
   where id = p_id and cancelled_at is not null;

  if row_session is null then
    return json_build_object('ok', false, 'reason', 'not-found');
  end if;

  perform pg_advisory_xact_lock(hashtext(row_session || '|' || row_date::text));

  select count(*) into taken
    from public.bookings
   where session_id = row_session and class_date = row_date and cancelled_at is null;

  if taken >= p_capacity then
    return json_build_object('ok', false, 'reason', 'full');
  end if;

  update public.bookings set cancelled_at = null where id = p_id;
  return json_build_object('ok', true);
exception
  when unique_violation then
    -- Someone rebooked with the same number while it was cancelled.
    return json_build_object('ok', false, 'reason', 'full');
end;
$$;


-- ---------------------------------------------------------------------------
-- Enquiries from the "Start here" form.
--
-- No unique constraint: the same person asking twice is two enquiries, and
-- dropping the second because it resembles the first is the exact failure
-- this table exists to end.
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id         bigint generated always as identity primary key,
  name       text        not null,
  phone      text        not null,
  email      text        not null,
  goal       text        not null,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create index if not exists leads_created_idx on leads (created_at desc);

-- Read and written only by the server, which holds the service role key.
alter table leads enable row level security;


-- ---------------------------------------------------------------------------
-- Staff accounts.
--
-- One row per person rather than one password everyone shares, so a sign-in
-- is attributable and removing someone does not mean changing a password for
-- everybody else. password_hash is scrypt - see src/lib/staff/password.ts.
-- ---------------------------------------------------------------------------
create table if not exists staff_users (
  username      text primary key,
  password_hash text        not null,
  role          text        not null default 'staff' check (role in ('admin', 'staff')),
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- For a table created before roles existed.
alter table staff_users add column if not exists role text not null default 'staff';

-- Read and written only by the server, which holds the service role key.
alter table staff_users enable row level security;


-- ---------------------------------------------------------------------------
-- Editable pieces of the site, as JSON under a key.
--
-- One table rather than one per section: prices, coaches and the timetable
-- differ only in shape. jsonb so the value is queryable if it ever needs to
-- be. edited_by and edited_at make a surprising change traceable.
-- ---------------------------------------------------------------------------
create table if not exists site_content (
  key       text primary key,
  value     jsonb       not null,
  edited_by text        not null,
  edited_at timestamptz not null default now()
);

alter table site_content enable row level security;
