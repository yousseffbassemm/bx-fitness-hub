import { NextResponse } from "next/server";
import { capacityFor, isRealDate } from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { getStore } from "@/lib/store";

// The store is node:sqlite; this cannot run on the Edge.
export const runtime = "nodejs";

/**
 * Places taken for every slot between ?from and ?to, plus each class's
 * capacity so the client can work out what is left.
 *
 * The client resolves which dates the timetable rows fall on in the
 * visitor's own timezone and sends the range, so a server running outside
 * Cairo never has to guess what "next Tuesday" means.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  // A real date, not just a date-shaped string: "2026-13-40" used to get
  // this far and fail in the database as an unexplained 503.
  if (!isRealDate(from) || !isRealDate(to) || from > to) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const capacity: Record<string, number> = {};
  const schedule = await getSchedule();
  for (let d = 0; d < schedule.length; d++) {
    for (const s of schedule[d].sessions) {
      capacity[s.id] = capacityFor(s.discipline);
    }
  }

  try {
    const taken = await (await getStore()).counts(from, to);
    return NextResponse.json(
      { capacity, taken },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[bx] availability lookup failed", error);
    return NextResponse.json({ error: "Availability unavailable" }, { status: 503 });
  }
}
