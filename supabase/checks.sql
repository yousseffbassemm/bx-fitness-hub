-- Is the live database what this repository says it should be?
--
-- Paste into the Supabase SQL editor and run. It only reads - there is no
-- statement in here that changes anything, so it is safe against production.
--
-- The first column is the clock. The SQL editor keeps the last result on
-- screen after you edit the query, so a row that describes a database from
-- an hour ago looks exactly like a row describing it now; checking the time
-- is how you tell. If checked_at is not roughly the current time, press Run.

select
  now()                                                   as checked_at,

  -- Should be 8: bookings, errors, leads, members, site_content,
  -- staff_users, uploads, waitlist. A list without members means the
  -- membership migration has not been applied, and every booking will
  -- record as a guest.
  (select string_agg(table_name, ', ' order by table_name)
     from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE') as tables,

  -- Should be 5: book_session, restore_booking, join_waitlist,
  -- promote_from_waitlist, record_error.
  (select count(*) from information_schema.routines
    where routine_schema = 'public')                      as function_count,

  -- Must be 0. Every table is reached through the service role, which
  -- bypasses RLS; a table with RLS off is one anon request from being
  -- public, and the member list is phone numbers.
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not c.relrowsecurity)                           as tables_without_rls,

  -- Both bookings indexes have to be here. One rule on phone alone breaks
  -- the Couples & Friends plan, where two memberships share one number.
  (select count(*) from pg_indexes
    where schemaname = 'public'
      and indexname in ('bookings_live_member_unique',
                        'bookings_live_guest_unique'))    as booking_rules,

  (select count(*) from public.members    where ended_at is null) as members_live,
  (select count(*) from public.bookings   where cancelled_at is null) as bookings_live,
  (select count(*) from public.waitlist   where promoted_at is null)  as waiting,
  (select count(*) from public.leads      where handled_at is null)   as leads_unhandled,
  (select count(*) from public.staff_users)                           as staff_accounts,
  (select count(*) from public.errors)                                as error_groups;
