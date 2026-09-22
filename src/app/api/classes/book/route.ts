import { NextResponse } from "next/server";
import { capacityFor, findSessionIn, isDateValidForRow } from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { report } from "@/lib/report";
import { LIMITS, allow, callerKey, tooManyMessage } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";

// The store is node:sqlite; this cannot run on the Edge.
export const runtime = "nodejs";

const PHONE = /^[+\d][\d\s-]{8,17}$/;

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

  const { sessionId, date, name, phone } = (body ?? {}) as Record<string, unknown>;

  if (typeof sessionId !== "string" || typeof date !== "string") {
    return NextResponse.json({ error: "Missing class or date" }, { status: 400 });
  }

  const found = findSessionIn(await getSchedule(), sessionId);
  if (!found) {
    return NextResponse.json({ error: "Unknown class" }, { status: 404 });
  }

  if (!isDateValidForRow(found.dayIndex, date)) {
    return NextResponse.json(
      { error: "That date is not bookable for this class" },
      { status: 400 },
    );
  }

  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Please give a name" }, { status: 400 });
  }
  // A ceiling, as the enquiry form has. Nothing legitimate is this long, and
  // without one the column takes whatever is sent.
  if (name.trim().length > 80) {
    return NextResponse.json({ error: "That name is too long" }, { status: 400 });
  }

  if (typeof phone !== "string" || !PHONE.test(phone.trim())) {
    return NextResponse.json({ error: "Please give a valid phone number" }, { status: 400 });
  }

  try {
    const result = await (await getStore()).book({
      sessionId,
      date,
      name: name.trim(),
      phone: phone.trim(),
      capacity: capacityFor(found.session.discipline),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "duplicate"
              ? "That number is already booked onto this class."
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
