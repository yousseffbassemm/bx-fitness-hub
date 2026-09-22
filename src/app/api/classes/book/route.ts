import { NextResponse } from "next/server";
import { capacityFor, findSessionIn, isDateValidForRow } from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { report } from "@/lib/report";
import { getStore } from "@/lib/store";

const PHONE = /^[+\d][\d\s-]{8,17}$/;

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
