-- BX Fitness Hub - class bookings
--
-- You only need this if you are deploying somewhere serverless, or running
-- more than one instance. On a single server the built-in SQLite store is
-- enough and needs no setup at all (see src/lib/store/sqlite.ts).
--
-- Run this once in the Supabase SQL editor, then set SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY. The app switches over on its own.

-- Only gen_random_uuid is used, and that is core Postgres since 13. Kept
-- because an older database may still need it; nothing here depends on it.
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
  taken   int;
  v_token text;
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

  -- The member's own handle on this booking, the thing the "cancel your
  -- place" link in their confirmation is made of. promote_from_waitlist
  -- mints one; this did not, so on Supabase every ordinary booking came
  -- back without one and the link led to /b/undefined - a 404 for everyone
  -- who booked the normal way. 16 bytes as hex, matching the other stores
  -- and the [a-f0-9]{16,64} the page checks.
  -- gen_random_uuid is core Postgres; gen_random_bytes is pgcrypto, which
  -- Supabase installs into the extensions schema. These functions pin
  -- search_path to public, so the pgcrypto call was unresolvable and every
  -- booking came back "function gen_random_bytes(integer) does not exist".
  -- Stripping the dashes off a uuid gives the same 32 hex characters the
  -- other stores produce, with nothing to install.
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.bookings (session_id, class_date, name, phone, token)
  values (p_session_id, p_date, p_name, p_phone, v_token);

  return json_build_object(
    'ok', true,
    'spots_left', p_capacity - taken - 1,
    'token', v_token
  );
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


-- ---------------------------------------------------------------------------
-- Uploaded images.
--
-- Stored as base64 text rather than bytea: PostgREST speaks JSON, and bytea
-- has no clean representation in it. The id is a content hash, so the same
-- file uploaded twice is one row and the URL can be cached indefinitely.
-- ---------------------------------------------------------------------------
create table if not exists uploads (
  id         text primary key,
  mime       text        not null,
  bytes_b64  text        not null,
  created_at timestamptz not null default now()
);

alter table uploads enable row level security;


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

-- One live entry per phone per slot, the same rule bookings follow.
create unique index if not exists waitlist_live_unique
  on waitlist (session_id, class_date, phone)
  where promoted_at is null;

create index if not exists waitlist_date_idx on waitlist (class_date);

alter table waitlist enable row level security;

create or replace function join_waitlist(
  p_session_id text, p_class_date date, p_name text, p_phone text
) returns json language plpgsql as $$
declare v_position int;
begin
  insert into waitlist (session_id, class_date, name, phone)
  values (p_session_id, p_class_date, p_name, p_phone);

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
-- v_id is the new booking's id, and bookings.id is a uuid. It was declared
-- bigint here, left over from before that column changed, so every
-- promotion failed on the RETURNING with "invalid input syntax for type
-- bigint" - the waitlist accepted people and could never move one of them
-- into a place.
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

  -- gen_random_uuid is core Postgres; gen_random_bytes is pgcrypto, which
  -- Supabase installs into the extensions schema. These functions pin
  -- search_path to public, so the pgcrypto call was unresolvable and every
  -- booking came back "function gen_random_bytes(integer) does not exist".
  -- Stripping the dashes off a uuid gives the same 32 hex characters the
  -- other stores produce, with nothing to install.
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into bookings (session_id, class_date, name, phone, token, promoted_at)
  values (p_session_id, p_class_date, v_next.name, v_next.phone, v_token, now())
  returning id into v_id;

  update waitlist set promoted_at = now() where id = v_next.id;

  return (select row_to_json(b) from bookings b where b.id = v_id);
exception when unique_violation then
  return null;
end;
$$;


-- ---------------------------------------------------------------------------
-- Server-side failures, grouped.
--
-- A broken endpoint produces the same error a thousand times; a thousand
-- identical rows is not more information than one row and a count.
-- ---------------------------------------------------------------------------
create table if not exists errors (
  fingerprint text primary key,
  where_at    text        not null,
  message     text        not null,
  detail      text,
  count       integer     not null default 1,
  last_at     timestamptz not null default now()
);

alter table errors enable row level security;

create or replace function record_error(
  p_fingerprint text, p_where text, p_message text, p_detail text
) returns void language sql as $$
  insert into errors (fingerprint, where_at, message, detail)
  values (p_fingerprint, p_where, p_message, p_detail)
  on conflict (fingerprint) do update
     set count = errors.count + 1,
         last_at = now(),
         detail = coalesce(excluded.detail, errors.detail);
$$;
