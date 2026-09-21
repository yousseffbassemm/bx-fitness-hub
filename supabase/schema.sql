-- BX Fitness Hub - class bookings
--
-- Run this once in the Supabase SQL editor, then set SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY in the environment. Until those are set the app
-- falls back to an in-process store (see src/lib/store/memory.ts).

create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  session_id  text        not null,
  class_date  date        not null,
  name        text        not null,
  phone       text        not null,
  created_at  timestamptz not null default now(),
  -- one place per phone number per class
  unique (session_id, class_date, phone)
);

create index if not exists bookings_date_idx on public.bookings (class_date);

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
     and class_date = p_date;

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
