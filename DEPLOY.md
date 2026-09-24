# Putting the site online

The site runs anywhere that can run Next.js with a Node runtime. These notes
are written for Vercel because that is what it is going to.

The database is already live — Supabase, with real bookings in it. Deploying
does not create a new one or move anything; the deployed site reads the same
database this machine has been reading all along.

## Before starting

Nothing has to be changed in the code. What you need is:

- The Supabase project's URL and **service role** key. Both are in Supabase
  under Settings → API. They are also in `.env.local` on this machine, which
  is gitignored and has never been committed.
- The staff session secret from `.env.local`. **Reuse the existing one** — a
  new secret signs out everyone who is currently signed in.
- A domain, if you want one. Vercel gives you a `*.vercel.app` address for
  free and a custom domain can be added later without redeploying.

## Environment variables

Set these in Vercel under Settings → Environment Variables, for Production
(and Preview, if you want preview deploys to work).

| Variable | Required | What happens without it |
| --- | --- | --- |
| `SUPABASE_URL` | **yes** | The build fails on purpose. See below. |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Same. |
| `STAFF_SESSION_SECRET` | **yes** | Must be 32+ characters. Shorter or missing and the staff area switches off entirely — it fails closed, because a staff area that lets everyone in is worse than one that is not there. |
| `NEXT_PUBLIC_SITE_URL` | yes, in practice | Defaults to `http://localhost:3000`, which ends up in page metadata and shared links. Set it to the real address. |
| `RESEND_API_KEY` | no | No email is sent. Enquiries are still saved and still appear on the Enquiries screen. |
| `NOTIFY_EMAIL_TO` | no | Same — nothing is emailed. |
| `NOTIFY_EMAIL_FROM` | no | Must be an address on a domain verified at Resend, or the provider refuses every message. |
| `GOOGLE_PLACES_API_KEY` | no | Reviews come from the dated snapshot in the repo instead of live from Google. |
| `GOOGLE_PLACE_ID` | no | Same. |

Do **not** set `BOOKINGS_DB_PATH` in production. It only selects the SQLite
file, and SQLite must not be used on a serverless host — see below.

## The build refuses a deploy with no database

Without the two Supabase variables the store falls back to SQLite. On one
server that is the point of it. On a serverless host it means one of two
things and neither is survivable: the filesystem is read-only, so every
booking fails; or it is writable but per-instance and wiped on the next
deploy, so bookings are taken, confirmed, and quietly gone. Nothing about the
second looks wrong until somebody turns up for a class they are not on.

So `next.config.ts` stops the build and names both variables. This only
applies to hosted builds — Vercel sets `VERCEL`, and `BX_REQUIRE_SUPABASE=1`
does the same on any host that does not. A local build and CI set neither and
carry on with SQLite, which is how the tests run without touching anything
real.

## Deploying

1. Import `yousseffbassemm/bx-fitness-hub` at vercel.com/new. Vercel detects
   Next.js; the framework, build command and output directory are all correct
   by default.
2. Add the environment variables above **before** the first build. Without
   them the build fails by design, which is the check working rather than
   something being wrong.
3. Deploy. Every push to `main` deploys automatically after that.

## After the first deploy

Worth checking, in this order:

1. The home page loads and the timetable shows places left. That proves the
   deployed site is reading Supabase.
2. Sign in at `/staff`. If it refuses, `STAFF_SESSION_SECRET` is missing or
   under 32 characters.
3. Make one booking as a guest, check it appears on the Bookings screen, and
   cancel it. That proves the whole write path end to end.
4. `supabase/queries/01-health-check.sql` should still read 8 tables, 5
   functions, 0 tables without RLS, and 2 booking rules.

## Changing things afterwards

**Content** — prices, timetable, coaches, facilities, gallery, members, staff
accounts. Edit them on the deployed site's own `/staff` screens. Saving calls
`revalidatePath("/")`, so the public page updates immediately. No redeploy.

**Code** — anything else. Push to `main`; Vercel rebuilds and it is live in a
couple of minutes.

## Working on this machine once the site is live

`npm run dev` deliberately ignores the Supabase settings in `.env.local` and
uses a local SQLite file under `.data/` instead. Once the site is live that
database holds real bookings from real people, and a dev server pointed at it
turns a test booking into a real name on a real class list.

- `npm run dev` — local SQLite. Safe. Starts empty.
- `npm run dev:live` — the live database. For when looking at real data is
  the actual point.
- `BX_LIVE=1 npm run dev:watch` — same opt-in for the watchdog.

No test can reach Supabase. The suites that go through the store clear the
credentials and then assert `supabaseConfigured === false` before running
anything; the store contract suite imports the SQLite and memory stores
directly, so it has no path to Supabase at all.
