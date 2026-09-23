import { NextResponse } from "next/server";
import { capacityFor, findSessionIn, hasStarted, isDateValidForRow } from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { resolveParty } from "@/lib/booking-party";
import { report } from "@/lib/report";
import { LIMITS, allow, callerKey, tooManyMessage } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

// The store is node:sqlite; this cannot run on the Edge.
export const runtime = "nodejs";

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
  if (!found) {
    return NextResponse.json({ error: "Unknown class" }, { status: 404 });
  }

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

  // Member or guest, decided against the database rather than against what
  // the browser says it is.
  const party = await resolveParty((body ?? {}) as Record<string, unknown>);
  if (!party.ok) {
    return NextResponse.json(
      { error: party.error, reason: party.reason },
      { status: party.status },
    );
  }

  try {
    const result = await (await getStore()).book({
      sessionId,
      date,
      name: party.name,
      phone: party.phone,
      capacity: capacityFor(found.session.discipline),
      memberId: party.memberId,
      payment: party.payment,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "duplicate"
              // "That number" used to mean the phone and only the phone.
              // It could now mean a membership number too, so it says who
              // rather than which number.
              ? "You already have a place in this class."
              : "This class just filled up.",
          reason: result.reason,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      spotsLeft: result.spotsLeft,
      token: result.token,
    });
  } catch (error) {
    await report("POST /api/classes/book", error, `${sessionId} on ${date}`);
    return NextResponse.json({ error: "Could not take that booking" }, { status: 503 });
  }
}
