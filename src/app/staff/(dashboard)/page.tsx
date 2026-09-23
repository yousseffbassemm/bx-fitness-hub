import {
  BOOKING_WINDOW_DAYS,
  capacityFor,
  findSessionIn,
  formatDate,
  toISODate,
} from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { getStore } from "@/lib/store";
import type { BookingRow } from "@/lib/store/types";
import BookingRowActions from "@/components/staff/BookingRowActions";
import PageHeader from "@/components/staff/PageHeader";
import PaidToggle from "@/components/staff/PaidToggle";
import PromotedActions from "@/components/staff/PromotedActions";

// Bookings change constantly; never serve a cached list.
export const dynamic = "force-dynamic";

type Group = {
  date: string;
  time: string;
  discipline: string;
  coach: string;
  ladiesOnly: boolean;
  capacity: number;
  people: Pick<
    BookingRow,
    | "id"
    | "name"
    | "phone"
    | "cancelledAt"
    | "memberId"
    | "memberNo"
    | "payment"
    | "paidAt"
  >[];
};

export default async function StaffPage(props: PageProps<"/staff">) {
  const params = await props.searchParams;
  const raw = Array.isArray(params.date) ? params.date[0] : params.date;

  const today = toISODate(new Date());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(raw ?? "") ? raw! : today;

  /*
    Built from the parts rather than new Date(from): a bare YYYY-MM-DD is
    parsed as UTC midnight, and toISODate reads the local parts back, so west
    of Greenwich the window would close a day early. The rest of this codebase
    splits the string by hand for the same reason.
  */
  const [fy, fm, fd] = from.split("-").map(Number);
  const until = new Date(fy, fm - 1, fd + BOOKING_WINDOW_DAYS);
  const to = toISODate(until);

  const store = await getStore();
  const rows = await store.list(from, to);
  const liveCount = rows.filter((r) => r.cancelledAt === null).length;

  const schedule = await getSchedule();

  /*
    People who were moved off the waitlist into a real place and have not
    been told yet. A waitlist that silently promotes someone who never finds
    out is worse than no waitlist: the place is taken and nobody uses it.
  */
  const promoted = await store.listPromoted(from, to);
  const waitlist = (await store.listWaitlist(from, to)).filter(
    (w) => w.promotedAt === null,
  );

  /*
    Bookings whose class is no longer on the timetable used to be skipped
    here, which meant someone who had booked simply vanished from this page
    with nothing said. They are collected instead and shown at the end: the
    class may be gone, but the person still turned up expecting it.
  */
  const orphaned: typeof rows = [];

  // Group by the actual class, so staff read it the way the day runs.
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const found = findSessionIn(schedule, row.sessionId);
    if (!found) {
      if (row.cancelledAt === null) orphaned.push(row);
      continue;
    }

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
      memberId: row.memberId,
      memberNo: row.memberNo,
      payment: row.payment,
      paidAt: row.paidAt,
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
    <>
      <PageHeader
        kicker="Classes"
        title={`${liveCount} ${liveCount === 1 ? "booking" : "bookings"}`}
        copy={`${formatDate(from)} onwards, the next ${BOOKING_WINDOW_DAYS} days.`}
        actions={
          <form method="GET" className="flex items-end gap-2">
            <label htmlFor="from" className="sr-only">
              Show bookings from
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
              className="font-display rounded-sm border border-white/15 px-4 py-2 text-[0.72rem] tracking-[0.12em] text-white transition-colors hover:border-lime hover:text-lime"
            >
              Go
            </button>
          </form>
        }
      />

      {promoted.length > 0 && (
        <section className="mt-10 rounded-sm border border-lime/40 bg-lime/[0.06] p-5">
          <h2 className="font-display text-base text-lime">
            {promoted.length} {promoted.length === 1 ? "person" : "people"} moved off
            the waitlist &mdash; call {promoted.length === 1 ? "them" : "them all"}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-grey">
            A place came free and they now have it. They do not know yet.
          </p>
          <ul className="mt-4 divide-y divide-white/8">
            {promoted.map((row) => {
              const slot = findSessionIn(schedule, row.sessionId);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="text-sm text-white">{row.name}</span>
                  <a
                    href={`tel:${row.phone.replace(/\s/g, "")}`}
                    className="text-sm tabular-nums text-grey hover:text-lime"
                  >
                    {row.phone}
                  </a>
                  <span className="text-xs text-grey-dim">
                    {slot ? `${slot.session.discipline}, ` : ""}
                    {formatDate(row.date)}
                  </span>
                  <PromotedActions id={row.id} name={row.name} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {waitlist.length > 0 && (
        <section className="mt-10 rounded-sm border border-white/10 bg-charcoal p-5">
          <h2 className="font-display text-base text-white">
            {waitlist.length} waiting for a place
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-grey-dim">
            In the order they joined. The longest waiting gets the next place
            that frees, automatically.
          </p>
          <ul className="mt-4 divide-y divide-white/8">
            {waitlist.map((w) => {
              const slot = findSessionIn(schedule, w.sessionId);
              return (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="text-grey">{w.name}</span>
                  <a
                    href={`tel:${w.phone.replace(/\s/g, "")}`}
                    className="tabular-nums text-grey-dim hover:text-lime"
                  >
                    {w.phone}
                  </a>
                  <span className="text-xs text-grey-dim">
                    {slot ? `${slot.session.discipline}, ` : ""}
                    {formatDate(w.date)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {orphaned.length > 0 && (
        <section className="mt-12 rounded-sm border border-amber/40 bg-amber/[0.06] p-5">
          <h2 className="font-display text-base text-amber">
            {orphaned.length}{" "}
            {orphaned.length === 1 ? "booking" : "bookings"} for a class that is
            no longer on the timetable
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-grey">
            The class was changed or removed after these were taken. They are
            still real people expecting to come - call them, then cancel the
            booking.
          </p>
          <ul className="mt-4 divide-y divide-white/8">
            {orphaned.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="text-sm text-white">{row.name}</span>
                <a
                  href={`tel:${row.phone.replace(/\s/g, "")}`}
                  className="text-sm tabular-nums text-grey hover:text-lime"
                >
                  {row.phone}
                </a>
                <span className="text-xs text-grey-dim">
                  {formatDate(row.date)}
                </span>
                <BookingRowActions id={row.id} cancelled={false} name={row.name} />
              </li>
            ))}
          </ul>
        </section>
      )}

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
                              {/*
                                Member or guest, because it decides what
                                happens at the desk: a member's place is part
                                of what they already pay for, a guest owes for
                                the class.
                              */}
                              {p.memberId ? (
                                <span className="rounded-sm border border-lime/40 px-1.5 py-0.5 text-[0.62rem] tracking-[0.1em] text-lime uppercase">
                                  Member{p.memberNo ? ` ${p.memberNo}` : ""}
                                </span>
                              ) : (
                                <>
                                  <span className="rounded-sm border border-white/15 px-1.5 py-0.5 text-[0.62rem] tracking-[0.1em] text-grey uppercase">
                                    Guest{p.payment ? ` \u00b7 ${p.payment}` : ""}
                                  </span>
                                  {/* Said they would pay is not the same as
                                      paid, so this is its own thing and it
                                      is a tap, not a screen. */}
                                  {!off && <PaidToggle id={p.id} paid={p.paidAt !== null} />}
                                </>
                              )}
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
    </>
  );
}
