-- Does the live database actually contain everything the repo declares?
--
-- supabase/schema/*.sql declares tables, indexes, functions and constraints.
-- This checks every one of them is really here. `missing` must be 0.
--
-- Run it after applying schema.sql. The health check (01) is the quick look;
-- this is the complete one.
--
-- Reads only.
--
-- The list below is checked against supabase/schema/*.sql by
-- tests/schema-build.test.ts. Add an object to the schema without adding it
-- here and that test fails - otherwise this query would keep reporting
-- everything present while quietly not looking at the new thing.

-- Does the live database contain everything supabase/schema/*.sql declares?
-- Every row should read "ok". Reads only.

with declared(kind, name) as (values
  ('table','bookings'),('table','errors'),('table','leads'),('table','members'),
  ('table','site_content'),('table','staff_users'),('table','uploads'),('table','waitlist'),
  ('index','bookings_date_idx'),('index','bookings_live_guest_unique'),
  ('index','bookings_live_member_unique'),('index','bookings_member_idx'),
  ('index','leads_created_idx'),('index','members_name_idx'),('index','members_no_idx'),
  ('index','members_phone_idx'),('index','waitlist_date_idx'),
  ('index','waitlist_live_guest_unique'),('index','waitlist_live_member_unique'),
  ('function','book_session'),('function','join_waitlist'),
  ('function','promote_from_waitlist'),('function','record_error'),('function','restore_booking'),
  ('constraint','bookings_payment_check'),('constraint','waitlist_payment_check')
)
select
  count(*)                                              as declared_objects,
  count(*) filter (where ok)                            as present,
  count(*) filter (where not ok)                        as missing,
  coalesce(string_agg(name, ', ') filter (where not ok), 'none') as missing_names
from (
  select d.kind, d.name,
    (exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relname=d.name and c.relkind in ('r','i','I')
    ) or exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname=d.name
    ) or exists (
      select 1 from pg_constraint where conname=d.name
    )) as ok
  from declared d
) t;
