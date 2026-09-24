# The database

BX runs on one of three interchangeable stores, chosen at startup by what is
configured (`src/lib/store/index.ts`):

| Store    | When it is used                          | Setup        |
| -------- | ---------------------------------------- | ------------ |
| Supabase | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set | this folder |
| SQLite   | otherwise, on a machine with a filesystem | none |
| memory   | last resort, if `node:sqlite` will not load | none |

**You only need what is in here if you are deploying somewhere serverless, or
running more than one instance.** On a single server the SQLite store is
enough and needs no setup at all.

## Applying it

Paste `schema.sql` into the Supabase SQL editor and run it, then set the two
environment variables. The app switches over on its own.

Running it again is safe. Every statement is written to be repeatable —
`create ... if not exists`, `create or replace`, `add column if not exists` —
so applying it to a database that already has some of it only adds what is
missing. Supabase will warn about "potentially destructive operations" when a
`drop index` or `drop function` is in the diff; those drops are only ever of an
index or a function that the next statement recreates, never of a table or a
row.

## Editing it

`schema.sql` is **generated**. Edit the part you mean, then rebuild:

```bash
npm run schema              # rewrites supabase/schema.sql from the parts
npm run schema -- --check   # fails if it is stale (CI runs this via the tests)
```

The parts are the source of truth; the single file exists because pasting one
file into the SQL editor is the actual workflow, and pasting eleven in the
right order is a mistake waiting to happen.

## Queries you will want again

`queries/` holds the read-only queries worth keeping. Each one is also saved
in the Supabase SQL editor under the same number and name, so the two line up:

| File | Saved in Supabase as |
| --- | --- |
| `queries/01-health-check.sql` | `01 Health check - live vs repo` |
| `queries/02-members.sql` | `02 Members - the list booking checks against` |
| `queries/03-bookings.sql` | `03 Bookings - who is coming, and who owes` |
| `queries/04-enquiries.sql` | `04 Enquiries - asked to be called, not yet called` |
| `queries/05-errors.sql` | `05 Errors - what has gone wrong on the server` |

Not one of them writes anything, so they are safe to run against production.
The staff screens cover the same ground for day to day work; these are for
when you want to look at the database directly.

**The health check is the one to run first when something looks wrong.** It
reports the eight tables, the five functions, row level security on every
table, and both booking unique indexes. Its first column is `checked_at`, and
that is deliberate: the SQL editor keeps the last result on screen while you
edit the query above it, so a row describing the database an hour ago looks
exactly like a row describing it now. If `checked_at` is not roughly the
current time, press Run - you are reading a stale result.

Editing a query in the Supabase editor does not change the file here, and
editing the file does not change Supabase. When you change one, paste it into
the other.

## The parts, in the order they run

The filenames carry the order, and the order matters: `bookings` references
`members`, and the functions reference both.

| File | What it holds |
| --- | --- |
| `01-extensions.sql` | `pgcrypto`, for `gen_random_uuid` |
| `02-bookings.sql` | the bookings table, its indexes, and the two rules below |
| `03-members.sql` | the membership list booking checks names against |
| `04-bookings-membership.sql` | what a booking says about who made it, and whether they paid |
| `05-booking-functions.sql` | `book_session`, `restore_booking` |
| `06-leads.sql` | enquiries from the "Start here" form |
| `07-staff-users.sql` | who can sign in, and whether they are admin |
| `08-site-content.sql` | everything the staff screens edit |
| `09-uploads.sql` | coach and facility photographs |
| `10-waitlist.sql` | the queue, and `join_waitlist` / `promote_from_waitlist` |
| `11-errors.sql` | server-side failures, grouped, and `record_error` |

## Two things worth knowing before changing anything

**One place per person, where "person" means the membership if there is one.**
There are two partial unique indexes on `bookings`, not one. A membership books
a class once; a guest phone books a class once; neither stands in for the
other. Collapsing them back into a single rule on `phone` breaks the Couples &
Friends plan, where two memberships share one number — the second of a couple
gets refused as a duplicate of the first.

**Every table has row level security on and no policy.** That is deliberate,
not unfinished. The database is only ever reached by the server using the
service role key, which bypasses RLS; granting anon anything would put the
member list and everybody's phone number one request away from the public.
