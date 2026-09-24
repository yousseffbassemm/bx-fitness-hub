-- Bookings: member or guest
--
-- Part of the schema. See supabase/README.md.

-- ---------------------------------------------------------------------------
-- What a booking now says about who made it.
--
-- member_id survives the member being removed as null, and name and phone
-- are still written onto the booking itself, so a class list a year from now
-- still reads as the people who turned up.
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists member_id uuid references public.members (id) on delete set null;

alter table public.bookings
  add column if not exists payment text;

-- ---------------------------------------------------------------------------
-- Whether a guest has actually handed the money over.
--
-- payment is what they said they would do; this is what happened. At seven
-- o'clock the desk's question is not "cash or card", it is "has this one
-- paid" - and without this the list looked identical for somebody who paid an
-- hour ago and somebody who walked straight past.
--
-- Null on a member, always: there is nothing for them to pay.
-- ---------------------------------------------------------------------------
alter table public.bookings add column if not exists paid_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_payment_check'
  ) then
    alter table public.bookings
      add constraint bookings_payment_check
      check (payment is null or payment in ('cash'));
  end if;
end;
$$;

create index if not exists bookings_member_idx on public.bookings (member_id);
