import { NextResponse } from "next/server";
import { findSessionIn, isDateValidForRow } from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

const PHONE = /^[+\d][\d\s-]{8,17}$/;

/** Join the waitlist for a class that is already full. */
export async function POST(request: Request) {
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
  if (!found) return NextResponse.json({ error: "Unknown class" }, { status: 404 });

  if (!isDateValidForRow(found.dayIndex, date)) {
    return NextResponse.json(
      { error: "That date is not bookable for this class" },
      { status: 400 },
    );
  }
  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Please give a name" }, { status: 400 });
  }
  if (typeof phone !== "string" || !PHONE.test(phone.trim())) {
    return NextResponse.json({ error: "Please give a valid phone number" }, { status: 400 });
  }

  const result = await (await getStore()).joinWaitlist({
    sessionId,
    date,
    name: name.trim(),
    phone: phone.trim(),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "You are already on the list for this class." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, position: result.position });
}
