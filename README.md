# BX Fitness Hub

Website for **BX Fitness Hub**, a gym in New Cairo. *Where movement meets style.*

Built with Next.js 16 (App Router), TypeScript and Tailwind CSS v4.

## Setup on a fresh Mac

You need [Homebrew](https://brew.sh) first. Then:

```bash
brew install node          # installs Node and npm
git clone https://github.com/yousseffbassemm/bx-fitness-hub.git
cd bx-fitness-hub
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run build   # production build - run before pushing
npm run lint    # ESLint
```

## Daily Git routine

**Before you start:**

```bash
git pull
```

**After a piece of work:**

```bash
git add .
git commit -m "describe what you changed"
git push
```

Two rules:

- **Never force-push and never rewrite history.** No `git push --force`, no
  `git rebase` on commits that are already pushed.
- If `git push` is rejected, `git pull`, resolve the conflict, push again.

## Where everything lives

```
src/
  app/
    layout.tsx          fonts, SEO metadata, LocalBusiness JSON-LD
    page.tsx            the homepage - just an ordered list of sections
    globals.css         design tokens + shared effects
    api/lead/route.ts   lead form endpoint
    api/classes/        availability + booking endpoints
    api/staff/          staff login / logout
    (site)/             the public site (navbar, footer, phone bar)
    staff/              password-protected bookings list
  proxy.ts              gates /staff before it renders
  components/
    Navbar.tsx          transparent over the hero, solid once scrolled
    Footer.tsx
    MobileBar.tsx       sticky Call / Book / Join bar on phones
    LeadForm.tsx        contact form with validation
    sections/           one file per homepage section
    ui/                 Logo, Button, Reveal, SectionHead
  lib/
    site.ts             ALL copy, data, hours, schedule, prices
    booking.ts          capacity, slot ids, date rules
    store/              booking storage (SQLite by default, Supabase optional)
supabase/schema.sql     run this once in Supabase
  images/               photography - imported, not served from public/
public/og.jpg           social preview (stable URL for crawlers)
```

**`src/lib/site.ts` is the file you edit most.** Phone numbers, opening hours,
the class timetable, coaches, membership perks and prices all live there. No
component hardcodes business information.

## Work split

| Area | Owner |
| --- | --- |
| Layout, Navbar, Footer, design tokens, `ui/` | Youssef |
| Hero, About, Stats, Facilities, Why | Youssef |
| Classes, Personal Training, Coaches | Youssef |
| Membership, Testimonials, Gallery | Karma |
| CTA, Contact, LeadForm, `api/lead` | Karma |
| Class booking (`lib/booking.ts`, `lib/store/`, `api/classes/`) | Youssef |
| `src/lib/site.ts` | Shared - tell the other person before you push |

Tell each other before touching `layout.tsx`, `globals.css` or `site.ts`.

## Design direction

Taken from the gym itself, not from a stock "gym website" palette.

| Token | Value | Where it comes from |
| --- | --- | --- |
| `--bx-lime` | `#c7ec1e` | The acid lime BX uses on every post |
| `--bx-pink` | `#ff2e8a` | **Ladies-only marker only.** Do not reuse it decoratively |
| `--bx-amber` | `#e8a54b` | The warm cove lighting on the walls and stair treads |
| `--bx-mint` | `#3fe0a0` | The physical PUSH YOUR LIMITS neon on the strength floor |
| `--bx-black` | `#08090a` | The training floor |
| `--bx-charcoal` | `#101214` | Raised surfaces |

Use them as Tailwind utilities: `text-lime`, `bg-charcoal`, `border-line`.

Type is **Archivo** for display and **Inter** for body. Archivo is loaded with
its width axis so `.font-display` can sit at `font-stretch: 82%`, which matches
the narrow lettering on BX's own posters. Headline pattern across the site is
white with one phrase dropped to lime, over a thin lime rule.

## Class booking

People book a place on the site. There is no WhatsApp anywhere on it -
enquiries go through the contact form, and the phone number is the only
direct line offered.

Each row of the timetable shows how many places are left and a **Book** button.
Booking asks for a name and a phone number only - no account, no payment. The
phone number is the identity: it is how the booking is found on the door, and
a number cannot be booked onto the same class twice.

**How the dates work.** The timetable is a weekly pattern, so a booking needs a
real date. The browser works out which date each row falls on next, in the
visitor's own timezone, and sends it. The server checks that the date really is
that weekday and falls inside the booking window before accepting it. A server
running outside Cairo therefore cannot put someone on the wrong day.

**Storage.** Bookings go into SQLite at `.data/bookings.db`, using the driver
built into Node - nothing to install and nothing to sign up for. A fresh clone
takes real bookings that survive a restart.

Writes open with `BEGIN IMMEDIATE`, which takes the write lock before reading
the count. That is what stops two people both being told there is one place
left and both taking it. Ten simultaneous requests for a single remaining
place produce exactly one booking.

That is the right store for **one server**. It is the wrong one for serverless
or for more than one instance, because each instance would own its own file.
For that, use Supabase:

1. Create a Supabase project (the free tier is enough).
2. Run `supabase/schema.sql` in its SQL editor.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`).

The app picks Supabase up automatically once both are set - no code change.
`book_session` in that schema takes an advisory lock for the same reason the
SQLite path takes the write lock.

Storage sits behind one small interface in `src/lib/store/`, so swapping in
Postgres, MySQL or anything else means writing one file.

**Capacity is a placeholder.** `DEFAULT_CLASS_CAPACITY` in `src/lib/booking.ts`
is set to 14 because BX has not said how many each class holds. Change that one
number, or give a discipline its own entry in `CAPACITY_BY_DISCIPLINE`.

**Not built yet**, in rough order of usefulness: a screen for BX to see the
day's bookings, cancellation, a waitlist when a class is full, and a reminder
the day before. Say the word and I will add them.

## Staff view

`/staff` shows the bookings for the next two weeks, grouped by day and then by
class: time, class, coach, how full it is, and every member's name and phone
number, with the numbers tappable to call.

Staff reach it from a quiet **Staff** link in the footer, next to the legal
links, or straight at `/staff`. For the front desk, save `/staff` to the home
screen - the apple touch icon means it gets the BX mark and behaves like an
app, which skips the marketing site entirely.

**It is behind a password**, because it holds personal data.

```bash
node scripts/staff-password.mjs "the password you want"
```

That prints `STAFF_PASSWORD_HASH` and `STAFF_SESSION_SECRET`. Put both in
`.env.local`. Without them the staff area refuses every login and says so -
it never falls open.

How it is protected:

- The password is stored as a **scrypt hash**, so the environment variable is
  not the password.
- Signing in sets an **httpOnly, sameSite=lax** cookie (secure in production),
  holding only an expiry and an HMAC of it. Editing the expiry invalidates the
  signature.
- `src/proxy.ts` checks the session **before the route renders**, so names and
  numbers are never produced for anyone without one - not even into a streamed
  payload.
- Sessions last **10 hours**, about a shift.
- Login is throttled to **8 attempts per IP per 10 minutes**.
- The pages are `noindex, nofollow`.

Wrong password, tampered cookie, garbage cookie, expired-but-correctly-signed
cookie, and post-logout all redirect to the login screen with nothing leaked.

### Cancelling a booking

Each member has a **Cancel** next to them. It takes two clicks - the first
arms it and names the person, the second does it - so a stray click cannot
cancel anyone.

**Cancelling never deletes the row.** It stamps `cancelled_at`, which frees
the place while keeping the record. The booking stays on the list, struck
through and marked CANCELLED, with an **Undo** beside it.

That design does three things:

- The freed place is immediately bookable by the public.
- Nobody's record quietly disappears, so staff can see that someone was
  cancelled rather than wondering whether they were ever booked.
- Undo is possible - and it re-checks capacity first, so if the place has
  since gone to someone else it refuses and says so.

Because cancelled rows are kept, "one place per phone per class" is a
**partial unique index over live rows only**. Without that, anyone who had
been cancelled could never rebook. The SQLite store migrates an existing
database to this shape on first open, rebuilding the table because SQLite
cannot drop a table-level UNIQUE.

The endpoint (`PATCH /api/staff/bookings`) checks the session itself - the
proxy only covers the `/staff` pages, since the login route has to stay
reachable - and refuses a request whose `Origin` is not this host, on top of
the sameSite cookie.

Not built: individual staff accounts, and an audit trail of who cancelled
what. With one shared password there is no "who" to record.

## Reviews

The reviews section shows **every written review Google has** across BX's two
listings - BX Fitness Hub (4.6 from 76) and BX Spa (4.9 from 35, which Google
places "inside BX Fitness Hub, in front of Gate 6") - read on 22 September
2026 and stored in `src/lib/site.ts`. Six in all: the other 105 ratings carry
no text. Each card names which listing it came from. Some are excerpts, cut at
a sentence, because Google truncates long reviews in its own interface.

The cards are a **swipeable deck**: the middle one is sharp, its neighbours
fall away - smaller, dimmer and progressively blurred the further out they
sit. Swipe on a touchscreen, drag with a mouse, use the arrow buttons, or
focus the deck and press the arrow keys.

It is built on a **real scroll container with CSS scroll snapping**, not a
hand-written slider. The momentum, rubber-banding and snap all come from the
browser's own scrolling, which is what makes a swipe feel right - no
JavaScript animation loop matches it on a touchscreen. The only thing measured
in JS is how far each card sits from the centre, written to a CSS variable
once per animation frame; the blur, scale and rotation are all CSS off that
one number. Mouse drag is the one part the browser does not give for free, so
that is handled, and snapping is handed straight back on release rather than
animating to a target and fighting the user's momentum.

Under `prefers-reduced-motion` the deck becomes a plain readable row that
still scrolls.

Two things to know before launch:

**They are a snapshot and will go stale.** The durable way is the
[Google Places API](https://developers.google.com/maps/documentation/places/web-service/details):
`GET /place/details` with `fields=rating,user_ratings_total,reviews` returns
the current rating and up to five reviews. That needs a
`GOOGLE_PLACES_API_KEY` and the place id, which for this listing is in the
maps URL. Ask and it is a short job to wire - the section already reads from
one array, so only where that array comes from would change.

**Copying reviews out of Google Maps by hand is against Google's terms.**
Serving them through the Places API, with Google attribution shown (the cards
already carry the Google mark), is the licensed route. Worth doing before the
site is public.

**BX's Google reviews are almost all about the spa.** The gym listing's own
keyword chips read "moroccan bath 16, jacuzzi 5, sauna 4", and all six written
reviews are about the hammam, the jacuzzi or the massage. There are no
gym-floor reviews to quote. If BX wants those on the gym site, the answer is
to ask members for them - no amount of code will conjure them.

## Still to fill in

Everything below is a marked placeholder. Search for the bracketed token.

| Placeholder | Where | Note |
| --- | --- | --- |
| `[MONTHLY PRICE]` `[ANNUAL PRICE]` `[COUPLES PRICE]` | `site.ts` &rarr; `plans` | BX does not publish prices; they are quoted on request. The **benefits listed are real**. |
| `[EMAIL ADDRESS]` | `site.ts` &rarr; `site.email` | No public email exists yet. |
| Team photo | `PersonalTraining.tsx` | Using a free-weights shot. BX's TEAM highlight is video only, so there is no group photo to pull. |
| Privacy / Terms | `Footer.tsx` | Marked `[TODO]`. |
| Lead destination | `api/lead/route.ts` | Currently validates and logs. Point it at an inbox or CRM. |
| Class capacity | `booking.ts` &rarr; `DEFAULT_CLASS_CAPACITY` | Set to 14 as a stand-in. |
| Booking storage | `.env` | SQLite by default. Supabase needed only for serverless or multi-instance. |
| Staff password | `.env.local` | Run `node scripts/staff-password.mjs`. Until set, `/staff` refuses every login. |
| `site.url` | `site.ts` | Set the real domain - it feeds canonical URLs and OG tags. |

## About the photography

Images live in `src/images/` and are **imported**, never referenced by a
path under `public/`. A file in `public/` is served at a URL that never
changes, so a browser that cached it keeps showing the old picture after the
file is replaced - which is exactly what happened when the coach portraits
were re-cropped. Importing makes Next fingerprint each file
(`ahmed-ayman.2ms5clqtjmcww.jpg`), so changing a photo changes its URL and
every visitor gets the new one. Drop a replacement in with the same filename
and it just works.

The one exception is `public/og.jpg`, the social preview. Crawlers cache by
URL, so that one is deliberately stable.


`public/images/` holds frames captured from the gym's own Instagram and cropped
to remove the baked-in campaign text. They top out around **1000-1100px**, which
is fine for cards and the gallery but thin for anything full-bleed on a large
desktop.

Before launch, replace them with original files from BX's photographer, keeping
the same filenames. Nothing in the code needs to change.

## Notes

- The class timetable in `site.ts` is transcribed from BX's **September 2026**
  schedule card. It changes monthly - update it when BX posts a new one.
- Ladies-only sessions are flagged `ladiesOnly: true` and render in pink,
  matching how BX marks them on their own schedule.
- No gym facts are invented. Hours, phone numbers, rating, coach names, class
  names and membership benefits all come from BX's Instagram or Google listing.

## Style notes

- Mobile-first: write the small-screen styles, then add `sm:` / `md:` / `lg:`.
- Server Components by default. Add `"use client"` only when you need state or
  browser events - `Navbar`, `Classes`, `Gallery`, `Stats` and `LeadForm` do.
- Keep animation behind `Reveal`, which already respects
  `prefers-reduced-motion`. It takes a `variant` (`up`, `down`, `left`,
  `right`, `scale`, `fade`) and a `delay` in ms for staggering a list. One
  shared IntersectionObserver serves the whole page. The travel distances are
  deliberately large - a 20px drift reads as a glitch on a wide screen, while
  a card that clearly slides in from the left reads as intent.
- Run `npm run build` before pushing.
