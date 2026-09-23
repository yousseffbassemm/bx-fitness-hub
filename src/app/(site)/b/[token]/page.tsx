import Link from "next/link";
import { notFound } from "next/navigation";
import CancelBooking from "@/components/CancelBooking";
import { Button } from "@/components/ui/Button";
import { findSessionIn, formatDate } from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { site } from "@/lib/site";
import { report } from "@/lib/report";
import { getStore } from "@/lib/store";

// A booking's state changes; never serve a cached copy of it.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
};

/** The records are unreachable - which is not the same as a lost place. */
function BookingUnavailable() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-24">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-lime" />
        <span className="kicker">Your booking</span>
      </div>

      <h1 className="font-display mt-6 text-4xl leading-tight text-white">
        We can&rsquo;t reach the <span className="text-lime">bookings</span>
      </h1>

      <p className="mt-5 text-sm leading-relaxed text-grey">
        Your place has not gone anywhere &mdash; we just cannot read it this
        minute. Try this link again shortly. If you need it sorted now, call
        us and we will find it by your phone number.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button href={site.phone.href}>Call {site.phone.display}</Button>
        <Button href="/#classes" variant="outline">
          See the timetable
        </Button>
      </div>
    </section>
  );
}

/**
 * One member's booking, reachable by the link they were given.
 *
 * No account and no sign-in: the token in the URL is the authorisation, the
 * way a ticket is. It is unguessable and covers exactly one booking, so the
 * worst a leaked link can do is cancel the place it belongs to.
 */
export default async function BookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{16,64}$/.test(token)) notFound();

  // Reaching the records can fail, and what a member is told when it does
  // matters more here than anywhere else on the site: "not found" would
  // read as "your place is gone". It is not gone, the gym just cannot see
  // it this second, so say that and give them the phone.
  let booking;
  try {
    booking = await (await getStore()).getByToken(token);
  } catch (error) {
    await report("GET /b/[token]", error);
    return <BookingUnavailable />;
  }
  if (!booking) notFound();

  const found = findSessionIn(await getSchedule(), booking.sessionId);
  const cancelled = booking.cancelledAt !== null;

  return (
    <section className="mx-auto min-h-[70vh] max-w-lg px-6 py-20">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-lime" />
        <span className="kicker">{cancelled ? "Cancelled" : "Your booking"}</span>
      </div>

      <h1 className="font-display mt-6 text-4xl leading-tight text-white">
        {found ? found.session.discipline : "Your class"}
      </h1>

      <dl className="mt-8 space-y-3 border-t border-line pt-6 text-sm">
        <div className="flex justify-between gap-6">
          <dt className="text-grey-dim">When</dt>
          <dd className="text-right text-white">
            {formatDate(booking.date)}
            {found && ` at ${found.session.time}`}
          </dd>
        </div>
        {found && (
          <div className="flex justify-between gap-6">
            <dt className="text-grey-dim">Coach</dt>
            <dd className="text-right text-white">{found.session.coach}</dd>
          </div>
        )}
        <div className="flex justify-between gap-6">
          <dt className="text-grey-dim">Name</dt>
          <dd className="text-right text-white">{booking.name}</dd>
        </div>
      </dl>

      <Link
        href="/#classes"
        className="font-display mt-8 inline-flex items-center gap-2 text-[0.78rem] tracking-[0.12em] text-grey transition-colors hover:text-lime"
      >
        <span aria-hidden="true">&larr;</span> Back to the timetable
      </Link>

      {cancelled ? (
        <p className="mt-8 rounded-sm border border-white/10 bg-charcoal px-5 py-4 text-sm leading-relaxed text-grey">
          This place has been given up. If you want it back, book again from the
          timetable &mdash; it may have gone to someone else by now.
        </p>
      ) : (
        <>
          {!found && (
            <p className="mt-8 rounded-sm border border-amber/40 bg-amber/[0.06] px-5 py-4 text-sm leading-relaxed text-grey">
              This class is no longer on the timetable. Give the gym a call
              before you travel.
            </p>
          )}
          <CancelBooking token={token} />
        </>
      )}

      {/*
        This used to say the link was the only way back, which was true when
        it was written and is why the timetable now remembers a place on the
        device that took it. What is still true is the warning: the token is
        the authorisation, so anyone holding the link can cancel the place.
        Not shown on a cancelled booking - there is nothing left to guard.
      */}
      {!cancelled && (
        <p className="mt-10 text-xs leading-relaxed text-grey-dim">
          Keep this link if you are on a different phone to the one you booked
          on &mdash; otherwise the class in the timetable will take you back
          here. Anyone with the link can cancel the place, so it is not worth
          sharing.
        </p>
      )}
    </section>
  );
}
