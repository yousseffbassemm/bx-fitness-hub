import { NextResponse } from "next/server";
import {
  capacityFor,
  findSessionIn,
  hasStarted,
  isDateValidForRow,
  slotKey,
} from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { resolveParty } from "@/lib/booking-party";
import { report } from "@/lib/report";
import { LIMITS, allow, callerKey, tooManyMessage } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/** Join the waitlist for a class that is already full. */
export async function POST(request: Request) {
  if (!allow(callerKey(request), LIMITS.booking.limit, LIMITS.booking.windowMs)) {
    return NextResponse.json({ error: tooManyMessage }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, date } = (body ?? {}) as Record<string, unknown>;

  if (typeof sessionId !== "string" || typeof date !== "string") {
    return NextResponse.json({ error: "Missing class or date" }, { status: 400 });
  }

  const found = findSessionIn(await getSchedule(), sessionId);
  if (!found) return NextResponse.json({ error: "Unknown class" }, { status: 404 });

  if (hasStarted(found.session.time, date)) {
    return NextResponse.json(
      { error: "That class has already started.", reason: "started" },
      { status: 409 },
    );
  }
  if (!isDateValidForRow(found.dayIndex, date)) {
    return NextResponse.json(
      { error: "That date is not bookable for this class" },
      { status: 400 },
    );
  }
  // Who is queuing, decided the same way a booking decides it - so whoever
  // joined as a member comes off the queue as one.
  const party = await resolveParty((body ?? {}) as Record<string, unknown>);
  if (!party.ok) {
    return NextResponse.json(
      { error: party.error, reason: party.reason },
      { status: party.status },
    );
  }

  try {
    /*
      A waitlist is for a class with no room left. Without this check the
      route took anyone: a stale page, or a page held open while people
      cancelled, could put somebody in a queue for a class with thirteen
      free places - and nothing would ever move them, because promotion
      only happens when a booking is given up. They would wait for a class
      they could have walked into.
    */
    const store = await getStore();
    const taken = (await store.counts(date, date))[slotKey(sessionId, date)] ?? 0;
    if (taken < capacityFor(found.session.discipline)) {
      return NextResponse.json(
        { error: "There is still room in this class - book a place instead.", reason: "not-full" },
        { status: 409 },
      );
    }

    const result = await store.joinWaitlist({
      sessionId,
      date,
      name: party.name,
      phone: party.phone,
      memberId: party.memberId,
      payment: party.payment,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "You are already on the list for this class." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, position: result.position });
  } catch (error) {
    await report("POST /api/classes/waitlist", error, `${sessionId} on ${date}`);
    return NextResponse.json(
      { error: "Could not add you to the list just now. Please call us." },
      { status: 503 },
    );
  }
}
