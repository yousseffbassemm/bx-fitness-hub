-- Members
--
-- Part of the schema. See supabase/README.md.

-- ---------------------------------------------------------------------------
-- Members.
--
-- Classes are open to members and to anyone off the street, and the two are
-- not the same at the desk: a member's place is part of what they already
-- pay for, a guest pays for the class. So a booking has to say which it is,
-- and the only way to know is to have the membership list here.
--
-- phone is deliberately NOT unique. BX sells a Couples & Friends membership,
-- and two people on one phone number is exactly what that is. A lookup that
-- matches more than one membership asks for the number instead of guessing.
--
-- member_no is whatever BX already writes on a card or a spreadsheet, so it
-- is text and optional - a gym that numbers nobody still works, by phone.
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  member_no  text,
  name       text        not null,
  phone      text        not null,
  created_at timestamptz not null default now(),
  -- Stamped rather than deleted: a lapsed member keeps their history, and
  -- their old bookings still say who they were.
  ended_at   timestamptz
);

-- One membership per number, ignoring case and spacing, when there is one.
create unique index if not exists members_no_idx
  on public.members (lower(btrim(member_no)))
  where member_no is not null and btrim(member_no) <> '';

create index if not exists members_phone_idx on public.members (phone);
create index if not exists members_name_idx on public.members (lower(name));

alter table public.members enable row level security;
