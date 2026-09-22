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

## Backups

Everything the gym owns lives in one SQLite file: bookings, enquiries, staff
accounts, the editable content and the uploaded photographs. The watchdog
backs it up when it starts and every 24 hours after that, keeping the last 30.

```bash
npm run backup            # take one now
npm run backup:list       # what exists
npm run restore           # list, with row counts
npm run restore latest    # put one back
```

**Not `cp`.** The database runs in WAL mode, so recent writes live in
`bookings.db-wal` rather than in `bookings.db` - on this machine the main file
was 4KB while the log holding everything was 671KB. Copying the one file
produces a database with **no tables in it**, and you find that out on the day
you need it. `VACUUM INTO` asks SQLite for a consistent, compacted copy with
the log folded in, without stopping the server.

Every backup is opened and counted against the live database before it is
kept. If it does not match, it is deleted and the run fails loudly - a backup
nobody has read back is a guess.

Restoring moves the current database aside rather than overwriting it, so
restoring the wrong file is itself undoable, and it refuses to run while the
server still has the database open.

### Where they go

```bash
npm run backup -- --where                 # the current folder
npm run backup -- --set-dir "<folder>"    # change it, permanently
```

The choice is remembered in `.backup-dir` next to the code, which is
git-ignored because it is a property of the machine rather than the project.
It is a file rather than a shell variable because three different things take
backups - a person, the watchdog and the login agent - and they do not share
an environment.

**Right now it points at `.backups/`, beside the code, which is the same disk
as the database.** That protects against a bad edit, a bad migration or a
corrupted write. It does not protect against the Mac being lost, stolen or
dying, and the script says so after every run rather than leaving it implied.

iCloud Drive was the intended home and it does not work while that account is
out of space: the files get written and simply never upload, which looks
exactly like a working backup and is not one. A full backup is about 52KB, so
thirty of them come to roughly 1.5MB - freeing even a few megabytes of iCloud
is enough for years of them.

Anything that leaves the machine will do: a synced folder, an external drive,
a network share.

```bash
npm run backup -- --set-dir /Volumes/SomeDrive/bx-backups
```

Once the site is deployed somewhere, the database moves with it and that
host's own backups become the real answer - these scripts are for the
SQLite-on-a-machine setup.

`BACKUP_DIR` in the environment still overrides everything, for a one-off.
`BACKUP_KEEP` changes how many are kept (default 30).

On Supabase this is all handled by Supabase's own backups instead; these
scripts are for the SQLite deployment.

### Restoring, in full

```bash
npm run dev:stop
npm run restore              # pick one from the list
npm run restore bx-2026-09-22_1518.db
npm run dev:watch
```

## Checking it on a phone

`npm run dev` only answers on this Mac. To look at the site on a phone, start
it through the watchdog instead:

```bash
npm run dev:watch
```

It prints the addresses when it starts, and `npm run dev:url` prints them
again:

- **this Mac** - `http://localhost:3000`
- **a phone on the same Wi-Fi** - `http://<mac-address>:3000`, or
  `http://<hostname>.local:3000`, which keeps working when the router hands
  out a different address

Edits reload on both at once; there is nothing to refresh.

The watchdog runs `next dev` bound to every interface rather than just
localhost, and keeps it there: if the server exits, or stays up but stops
answering five checks in a row, it starts it again - about six seconds end to
end. It detaches from the terminal, so closing that terminal does not take the
link down with it.

| | |
| --- | --- |
| `npm run dev:watch` | start it (takes port 3000 back if something holds it) |
| `npm run dev:status` | is it up |
| `npm run dev:log` | follow the server output |
| `npm run dev:url` | print the addresses again |
| `npm run dev:stop` | stop it (the login agent will restart it; `uninstall-login` to stop it for good) |

It survives a reboot too: `scripts/dev-watchdog.sh install-login` registers a
launch agent that starts it at login and restarts it if it is ever killed -
verified by `kill -9`, which came back in two seconds.

That is also why the project lives in `~/Developer` and not on the Desktop.
macOS will not let a login agent open files inside `~/Desktop`, `~/Documents`
or `~/Downloads`; the agent loads and then fails with "Operation not
permitted" on every retry. Moving only the agent's entry point out is not
enough - it still cannot read the project. There is a symlink at
`~/Desktop/bx-fitness-hub` pointing here, so the old path still opens.
If you ever move this folder, run `install-login` again to repoint the agent.
`uninstall-login` undoes it.

### Away from home

It works on a phone's hotspot, as long as the Mac is the thing tethered to it -
the phone is then the router and the Mac is a device on its network, which is
the same situation as the home Wi-Fi.

What changes is the address. An iPhone hands out `172.20.10.x`, so the link is
a different one each time the network changes:

```bash
npm run dev:url
```

`npm run dev:watch` does not need re-running; the server is bound to every
interface, so it is already answering on the new one. Use the address rather
than the `.local` name, which often does not resolve over a hotspot.

### A public link

For showing the site to someone who is not on the network:

```bash
npm run tunnel:on      # prints a https://<words>.trycloudflare.com address
npm run tunnel:off     # kills it
```

This is a Cloudflare quick tunnel - no account, nothing registered. The
watchdog keeps it alive alongside the server.

Know what it means before using it:

- **It is public.** Anyone with the address can open it, and the address is
  the only thing protecting it. It is not indexed, but it is not private.
- **The address changes** every time the tunnel restarts, which includes
  every watchdog restart. `npm run dev:url` prints the current one.
- **The staff area stays locked** - checked from the public side: `/staff`
  redirects, the bookings API returns nothing without a session, and a wrong
  password is still a 401 behind the same rate limit.
- **Bookings and the contact form are live.** Anyone on that address can fill
  a class or send a lead, and it writes to the real store.
- Turn it off when you are done. `npm run tunnel:off`.

`allowedDevOrigins` in `next.config.ts` has to include `*.trycloudflare.com`
for this to work at all. Without it the page renders and then does nothing -
no reveals, no carousel, no form - because the dev requests are refused and
React never finishes hydrating.

Two things to know. The phone has to be on the same Wi-Fi - this is a link on
your network, not a public one, and nothing is exposed to the internet. And
`allowedDevOrigins` in `next.config.ts` is what lets the dev client talk to a
browser that reached the site by address rather than by localhost; without it
the page loads but edits never arrive. It has no effect on a production build.

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

## Telling somebody something happened

Optional, and off unless configured. Set `RESEND_API_KEY` and
`NOTIFY_EMAIL_TO` in `.env.local` and an email goes out when an enquiry
arrives, and when a waitlist place comes free and somebody needs calling.

Without them the site behaves exactly as it does now: everything is saved and
read on the staff screens. The notification is a nudge on top, never the
record - which is deliberate, because the enquiry form previously *was* a
notification with no record, and dropped people's details in silence.

Sending never blocks the request and never fails it. Verified with a
deliberately invalid key: the enquiry still saved and still answered 200,
while the provider's refusal was recorded on the Problems screen.

## Editing the site

Some of the page is editable by an admin at **Staff &rarr; Site content**, with
no developer and no deploy. Prices are the first of these.

It works the same way for everything: what is in `src/lib/site.ts` is the
default, and a row in `site_content` overrides it. A fresh clone renders
correctly with an empty database, an unreachable database falls back to the
code rather than taking the page down, and anything not yet editable simply
keeps using the code.

**Prices.** Price, period and the one-line blurb. What each plan includes is
a list of real, checked benefits, and the layout depends on which plan is
featured - both stay in the code where a change gets reviewed.

**Coaches.** Add, remove, reorder, rename, and upload a portrait. The cards
are a tall fixed shape and portraits are not, so each coach carries a crop
position, set with four buttons that show the result as the site will render
it. That used to be a developer editing a file - it is the thing that took
the most rounds to get right by hand.

Uploaded images go in the store as bytes, not onto disk: a serverless host
has a read-only filesystem and anything written to it goes away with the
instance. They are served from `/api/photo/<id>`, where the id is a hash of
the file's contents - so the URL can be cached forever, and re-uploading the
same photograph is a no-op. Uploads are checked on their first few bytes
rather than on the Content-Type they claim, and capped at 6MB.

A coach with no uploaded photo falls back to the image in the code, matched
by name, so the team can be reordered or renamed without re-uploading
everything first.

**Timetable.** Add, edit and remove classes on any day, including the
ladies-only flag. The seven days are fixed; what is in them is not.

This is the one edit that can reach something a member has already done, so
it is worth understanding. A booking stores a session id. That id used to be
*derived* from the day, the time and the discipline - so moving Boxing from
7pm to 8pm would have changed its id, left every booking for it pointing at
nothing, and dropped those people off the staff list without a word. A saved
session now carries its own id, fixed when the class is created and untouched
by later edits, and the ids seeded from the code are exactly the ones the old
derivation produced, so bookings taken before any of this still resolve.

So: **changing a class moves its bookings with it.** Removing a class leaves
those bookings attached to nothing, and the bookings page now says so at the
top - who they are and their phone number - instead of quietly skipping them.
The editor warns before you change a class that people have already booked.

The marketing page is prerendered, so saving calls `revalidatePath("/")`.
Without it a price would change in the database and the page would go on
showing the old one until the next deploy.

## Enquiries

The "Start here" form writes a row through the same store as the bookings, and
`/staff` lists them newest first, above the bookings, with a count of how many
are still waiting. Each one can be marked done and reopened; nothing is ever
deleted, so a row ticked off by mistake comes straight back.

They are deliberately not filtered by the booking date window - someone who
asked last week is still waiting to hear back.

Before this, the endpoint validated the payload and `console.info`d it. The
form told the visitor "we'll be in touch" and their details went to the
server's stdout, which the watchdog truncates on every start. Nothing was
stored and nobody was told.

## Staff view

The staff area is six screens behind one bar:

| | |
| --- | --- |
| **Bookings** | who is coming to which class, and cancelling |
| **Enquiries** | the "Start here" form, with a count of how many are waiting |
| **Timetable** | admin - the weekly classes |
| **Coaches** | admin - names, specialities, portraits and crops |
| **Facilities** | admin - the cards under "Every corner is made to move" |
| **Gallery** | admin - the mosaic, tall and square tiles |
| **Pricing** | admin - the three membership prices |
| **Team** | admin - accounts and roles |
| **Problems** | admin - server failures; only appears when there are some |

A non-admin sees the first two and nothing else, and the admin pages redirect
them rather than showing controls the server will refuse.

It is gated twice over: `src/proxy.ts` refuses the pages before they render,
so no member's name or number is ever produced for someone without a session,
and each state-changing API route checks for itself.

### Accounts

One account per person, not one password everyone shares - a sign-in is
attributable, and removing someone does not mean changing a password for
everybody else.

Day to day this is done on screen: an admin opens **Team** from the staff
page and can add someone, reset a password, change a role or remove an
account without anyone touching a terminal.

The command line is the way in when there is no admin left to let you in:

```bash
node scripts/staff-user.mjs list
node scripts/staff-user.mjs add    <username> [admin|staff]
node scripts/staff-user.mjs reset  <username>
node scripts/staff-user.mjs role   <username> <admin|staff>
node scripts/staff-user.mjs remove <username>
```

The first account created is always an admin - someone has to be able to
manage the rest.

### Roles

`staff` is the day job: the bookings and the enquiries. `admin` adds the team
screen. The role is read from the database on every request rather than
carried in the session token, so revoking someone takes effect immediately
instead of when their session happens to expire.

Neither the screen nor the command line will leave the team with no admin, and
nobody can demote or remove themselves - an account screen nobody can open is
fixable only by someone with a terminal.

Removing an account stops the next sign-in. A session already in hand stays
valid until it expires, which is at most ten hours; reset the password too if
it needs to end sooner.

The password is asked for, never passed as an argument: an argument ends up in
shell history and in the process list, where anyone on the machine can read it.
In a terminal it is typed twice with no echo.

Without a terminal - an editor's integrated shell, an agent, CI - there is
nothing for the prompt to read from, so pass it through the environment
instead:

```bash
STAFF_PASSWORD='the password' node scripts/staff-user.mjs add <username>
```

Piped input works too (`printf 'pw\npw\n' | ...`). If none of the three is
available the script says so and stops, rather than waiting on a prompt
nobody can answer.

Only a scrypt hash is stored, and there is no way back from it: a forgotten
password is reset, never recovered.

Usernames are 3-32 characters of `a-z`, `0-9`, `_` and `-`. No dots: the
session token is dot-separated and carries the username.

Accounts live in the database, so they follow whichever store is configured.
On Supabase, run the `staff_users` section of `supabase/schema.sql` first.

`STAFF_SESSION_SECRET` in `.env.local` is still needed - it signs the session
cookies. Changing it signs everyone out.


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
| `[MONTHLY PRICE]` `[ANNUAL PRICE]` `[COUPLES PRICE]` | Staff &rarr; Site content | Set on screen now, no developer needed. The values in `site.ts` are only the fallback. The **benefits listed are real**. |
| `[EMAIL ADDRESS]` | `site.ts` &rarr; `site.email` | No public email exists yet. |
| Team photo | `PersonalTraining.tsx` | Using a free-weights shot. BX's TEAM highlight is video only, so there is no group photo to pull. |
| Privacy / Terms | `Footer.tsx` | Marked `[TODO]`. |
| Lead destination | &mdash; | **Done.** Enquiries are rows in the same store as the bookings, and staff read them at `/staff`. Add email on top if BX wants a nudge as well. |
| Class capacity | `booking.ts` &rarr; `DEFAULT_CLASS_CAPACITY` | Set to 14 as a stand-in. |
| Booking storage | `.env` | SQLite by default. Supabase needed only for serverless or multi-instance. |
| Staff accounts | database | Run `node scripts/staff-user.mjs add <username>`. Until one exists, `/staff` refuses every login. |
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
