import {
  BOOKING_WINDOW_DAYS,
  capacityFor,
  findSession,
  formatDate,
  toISODate,
} from "@/lib/booking";
import { getStore } from "@/lib/store";
import { Mark } from "@/components/ui/Logo";

// Bookings change constantly; never serve a cached list.
export const dynamic = "force-dynamic";

type Group = {
  date: string;
  time: string;
  discipline: string;
  coach: string;
  ladiesOnly: boolean;
  capacity: number;
  people: { name: string; phone: string; createdAt: string }[];
};

export default async function StaffPage(props: PageProps<"/staff">) {
  const params = await props.searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;

  const today = toISODate(new Date());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(raw ?? "") ? raw! : today;

  const until = new Date(from);
  until.setDate(until.getDate() + BOOKING_WINDOW_DAYS);
  const to = toISODate(until);

  const rows = await (await getStore()).list(from, to);

  // Group by the actual class, so staff read it the way the day runs.
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const found = findSession(row.sessionId);
    if (!found) continue; // a slot that has since left the timetable

    const key = `${row.date}|${row.sessionId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        date: row.date,
        time: found.session.time,
        discipline: found.session.discipline,
        coach: found.session.coach,
        ladiesOnly: Boolean(found.session.ladiesOnly),
        capacity: capacityFor(found.session.discipline),
        people: [],
      });
    }
    groups.get(key)!.people.push({
      name: row.name,
      phone: row.phone,
      createdAt: row.createdAt,
    });
  }

  const ordered = [...groups.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
  );

  const byDate = new Map<string, Group[]>();
  for (const g of ordered) {
    if (!byDate.has(g.date)) byDate.set(g.date, []);
    byDate.get(g.date)!.push(g);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 text-white">
            <Mark className="h-8 w-8" />
            <span className="kicker">Staff &middot; Bookings</span>
          </div>
          <h1 className="font-display mt-5 text-3xl text-white sm:text-4xl">
            {rows.length} {rows.length === 1 ? "booking" : "bookings"}
          </h1>
          <p className="mt-2 text-sm text-grey">
            {formatDate(from)} onwards &middot; next {BOOKING_WINDOW_DAYS} days
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form method="GET" className="flex items-center gap-2">
            <label htmlFor="from" className="kicker">
              From
            </label>
            <input
              id="from"
              type="date"
              name="date"
              defaultValue={from}
              className="rounded-sm border border-white/15 bg-charcoal px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-lime focus:outline-none"
            />
            <button
              type="submit"
              className="font-display rounded-sm border border-white/15 px-4 py-2 text-[0.72rem] tracking-[0.12em] text-white hover:border-lime hover:text-lime"
            >
              Go
            </button>
          </form>

          <form method="POST" action="/api/staff/logout">
            <button
              type="submit"
              className="font-display rounded-sm border border-white/15 px-4 py-2 text-[0.72rem] tracking-[0.12em] text-grey hover:border-pink hover:text-pink"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>

      {ordered.length === 0 ? (
        <p className="mt-16 rounded-sm border border-white/10 bg-charcoal px-6 py-16 text-center text-sm text-grey">
          No bookings in this window.
        </p>
      ) : (
        <div className="mt-12 space-y-12">
          {[...byDate.entries()].map(([date, classes]) => (
            <section key={date}>
              <h2 className="font-display border-b border-white/10 pb-3 text-lg text-lime">
                {formatDate(date)}
              </h2>

              <div className="mt-6 space-y-6">
                {classes.map((g) => (
                  <article
                    key={`${g.date}-${g.time}-${g.discipline}`}
                    className="rounded-sm border border-white/10 bg-charcoal"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 px-5 py-4">
                      <div>
                        <h3 className="font-display text-base text-white">
                          {g.time} &middot; {g.discipline}
                        </h3>
                        <p className="mt-1 text-xs text-grey">
                          {g.coach}
                          {g.ladiesOnly && (
                            <span className="ml-2 text-pink">&middot; Ladies only</span>
                          )}
                        </p>
                      </div>
                      <p className="font-display text-sm text-white">
                        {g.people.length}
                        <span className="text-grey-dim">/{g.capacity}</span>
                      </p>
                    </div>

                    <ol className="divide-y divide-white/8">
                      {g.people.map((p, i) => (
                        <li
                          key={`${p.phone}-${i}`}
                          className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-4 px-5 py-3"
                        >
                          <span className="text-xs text-grey-dim">{i + 1}</span>
                          <span className="text-sm text-white">{p.name}</span>
                          <a
                            href={`tel:${p.phone.replace(/\s/g, "")}`}
                            className="text-sm tabular-nums text-grey hover:text-lime"
                          >
                            {p.phone}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-16 text-xs leading-relaxed text-grey-dim">
        This page shows members&apos; names and phone numbers. Do not share the
        link or leave it open on a screen the floor can see.
      </p>
    </main>
  );
}
