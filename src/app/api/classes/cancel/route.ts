import { NextResponse } from "next/server";
import { capacityFor, findSessionIn } from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * A member cancelling their own place.
 *
 * Authorised by the token issued when the booking was taken: unguessable and
 * specific to one booking, so nobody needs an account and nobody can reach
 * anyone else's place. The freed place is offered to the waitlist
 * immediately, which is the entire reason self-cancelling is worth having -
 * a place given back an hour before the class is only useful if someone else
 * can take it.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token } = (body ?? {}) as Record<string, unknown>;
  if (typeof token !== "string" || !/^[a-f0-9]{16,64}$/.test(token)) {
    return NextResponse.json({ error: "That link is not valid." }, { status: 400 });
  }

  const store = await getStore();
  const booking = await store.getByToken(token);

  if (!booking) {
    return NextResponse.json({ error: "We cannot find that booking." }, { status: 404 });
  }
  if (booking.cancelledAt !== null) {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  const result = await store.cancel(booking.id);
  if (!result.ok) {
    return NextResponse.json({ error: "That booking is already gone." }, { status: 409 });
  }

  // Hand the place straight to whoever has been waiting longest.
  let promoted = null;
  const found = findSessionIn(await getSchedule(), booking.sessionId);
  if (found) {
    promoted = await store.promoteFromWaitlist(
      booking.sessionId,
      booking.date,
      capacityFor(found.session.discipline),
    );
  }

  return NextResponse.json({ ok: true, promoted: Boolean(promoted) });
}
