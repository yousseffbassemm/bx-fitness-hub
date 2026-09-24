-- Bookings
--
-- Part of the schema. See supabase/README.md.

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

-- ---------------------------------------------------------------------------
-- One place per person, where "person" means the membership if there is one.
--
-- The old rule was one live booking per phone per class. That is right for
-- guests and wrong for members, because BX sells a Couples & Friends plan and
-- two memberships on one number is what that plan is - so the second of a
-- couple was refused as a duplicate of the first.
--
-- Two rules now. A membership books a class once. A guest phone books a class
-- once. Neither can stand in for the other.
-- ---------------------------------------------------------------------------
drop index if exists public.bookings_live_unique;

create unique index if not exists bookings_live_member_unique
  on public.bookings (session_id, class_date, member_id)
  where cancelled_at is null and member_id is not null;

drop index if exists public.bookings_live_guest_unique;

create unique index if not exists bookings_live_guest_unique
  on public.bookings (session_id, class_date, phone)
  where cancelled_at is null and member_id is null and payment is not null;

-- The table is only ever reached through the service role from the server,
-- so no anon policy is granted.
alter table public.bookings enable row level security;
