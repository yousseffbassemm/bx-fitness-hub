import {
  BOOKING_WINDOW_DAYS,
  capacityFor,
  findSession,
  formatDate,
  toISODate,
} from "@/lib/booking";
import { cookies } from "next/headers";
import { STAFF_COOKIE, readSessionToken } from "@/lib/staff/session";
import { getStore } from "@/lib/store";
import BookingRowActions from "@/components/staff/BookingRowActions";
import LeadRowActions from "@/components/staff/LeadRowActions";
import BackToSite from "@/components/staff/BackToSite";
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
  people: { id: string; name: string; phone: string; cancelledAt: string | null }[];
};

export default async function StaffPage(props: PageProps<"/staff">) {
  const params = await props.searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;

  const today = toISODate(new Date());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(raw ?? "") ? raw! : today;

  const until = new Date(from);
  until.setDate(until.getDate() + BOOKING_WINDOW_DAYS);
  const to = toISODate(until);

  // proxy.ts has already refused anyone without a valid session, so this is
  // only for showing whose shift it is.
  const signedInAs = await readSessionToken(
    (await cookies()).get(STAFF_COOKIE)?.value,
  );

  const store = await getStore();
  const rows = await store.list(from, to);
  // Enquiries are not tied to the date window - someone who asked last week is
  // still waiting to hear back.
  const leads = await store.listLeads();
  const waiting = leads.filter((l) => l.handledAt === null);
  const liveCount = rows.filter((r) => r.cancelledAt === null).length;

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
      id: row.id,
      name: row.name,
      phone: row.phone,
      cancelledAt: row.cancelledAt,
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
          <BackToSite className="mb-5" />
          <div className="flex items-center gap-2.5 text-white">
            <Mark className="h-8 w-8" />
            <span className="kicker">Staff</span>
            {signedInAs && (
              <span className="text-xs text-grey-dim">&middot; {signedInAs}</span>
            )}
          </div>
          <h1 className="font-display mt-5 text-3xl text-white sm:text-4xl">
            {liveCount} {liveCount === 1 ? "booking" : "bookings"}
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

      {/*
        Enquiries first. A booking is already settled - the person has a place
        and knows it. An enquiry is someone waiting for a call back, so it is
        the thing on this page that decays if nobody looks at it.
      */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 pb-3">
          <h2 className="font-display text-lg text-lime">
            Enquiries
            {waiting.length > 0 && (
              <span className="ml-3 rounded-sm bg-lime px-2 py-0.5 text-[0.7rem] tracking-[0.1em] text-ink">
                {waiting.length} waiting
              </span>
            )}
          </h2>
          <p className="text-xs text-grey-dim">
            From the &ldquo;Start here&rdquo; form &middot; newest first
          </p>
        </div>

        {leads.length === 0 ? (
          <p className="mt-6 rounded-sm border border-white/10 bg-charcoal px-6 py-10 text-center text-sm text-grey">
            No enquiries yet.
          </p>
        ) : (
          <ol className="mt-6 divide-y divide-white/8 rounded-sm border border-white/10 bg-charcoal">
            {leads.map((lead) => {
              const done = lead.handledAt !== null;
              return (
                <li
                  key={lead.id}
                  className={`flex flex-wrap items-start justify-between gap-4 px-5 py-4 ${
                    done ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-2.5 text-sm">
                      <span className={done ? "text-grey-dim" : "text-white"}>
                        {lead.name}
                      </span>
                      <span className="text-[0.7rem] tracking-[0.1em] text-grey-dim uppercase">
                        {lead.goal}
                      </span>
                      {done && (
                        <span className="text-[0.7rem] tracking-[0.1em] text-lime uppercase">
                          Done
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <a
                        href={`tel:${lead.phone.replace(/\s/g, "")}`}
                        className={`tabular-nums ${done ? "text-grey-dim" : "text-grey hover:text-lime"}`}
                      >
                        {lead.phone}
                      </a>
                      <a
                        href={`mailto:${lead.email}`}
                        className={`break-all ${done ? "text-grey-dim" : "text-grey hover:text-lime"}`}
                      >
                        {lead.email}
                      </a>
                    </p>
                    <p className="mt-1.5 text-xs text-grey-dim">
                      {formatDate(lead.createdAt.slice(0, 10))}
                    </p>
                  </div>

                  <LeadRowActions id={lead.id} handled={done} />
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <h2 className="font-display mt-16 border-b border-white/10 pb-3 text-lg text-white">
        Bookings
        <span className="ml-3 text-sm text-grey-dim">
          {formatDate(from)} onwards &middot; next {BOOKING_WINDOW_DAYS} days
        </span>
      </h2>

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
                        {g.people.filter((p) => p.cancelledAt === null).length}
                        <span className="text-grey-dim">/{g.capacity}</span>
                      </p>
                    </div>

                    <ol className="divide-y divide-white/8">
                      {g.people.map((p, i) => {
                        const off = p.cancelledAt !== null;
                        return (
                          <li
                            key={p.id}
                            className={`grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-4 px-5 py-3 ${
                              off ? "bg-white/[0.02]" : ""
                            }`}
                          >
                            <span className="text-xs text-grey-dim">
                              {off ? "\u2014" : i + 1}
                            </span>
                            {/* The strike sits on the name alone: a parent's
                                text-decoration is painted across children and
                                cannot be removed by them. */}
                            <span className="flex flex-wrap items-baseline gap-2 text-sm">
                              <span className={off ? "text-grey-dim line-through" : "text-white"}>
                                {p.name}
                              </span>
                              {off && (
                                <span className="text-[0.7rem] tracking-[0.1em] text-pink uppercase">
                                  Cancelled
                                </span>
                              )}
                            </span>
                            <a
                              href={`tel:${p.phone.replace(/\s/g, "")}`}
                              className={`text-sm tabular-nums ${
                                off ? "text-grey-dim" : "text-grey hover:text-lime"
                              }`}
                            >
                              {p.phone}
                            </a>
                            <BookingRowActions id={p.id} cancelled={off} name={p.name} />
                          </li>
                        );
                      })}
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
