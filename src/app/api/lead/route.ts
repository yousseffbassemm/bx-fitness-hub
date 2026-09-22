import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

/**
 * Lead capture for the "Start here" form.
 *
 * This used to validate the payload and console.info it, which meant the form
 * told a visitor "we'll be in touch" and then dropped their details on the
 * floor: nothing was stored, nobody was notified, and the log it printed to
 * was truncated on every restart. Enquiries are rows now, and staff read them
 * at /staff alongside the bookings.
 */
export const dynamic = "force-dynamic";

/** Long enough for a real answer, short enough that the column stays sane. */
const LIMITS = { name: 80, phone: 24, email: 160, goal: 120 } as const;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, phone, email, goal } = (body ?? {}) as Record<string, unknown>;

  const missing = Object.entries({ name, phone, email, goal })
    .filter(([, v]) => typeof v !== "string" || v.trim() === "")
    .map(([k]) => k);

  if (missing.length) {
    return NextResponse.json(
      { error: `Missing field(s): ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const lead = {
    name: (name as string).trim().slice(0, LIMITS.name),
    phone: (phone as string).trim().slice(0, LIMITS.phone),
    email: (email as string).trim().slice(0, LIMITS.email),
    goal: (goal as string).trim().slice(0, LIMITS.goal),
  };

  try {
    const { id } = await (await getStore()).saveLead(lead);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    // Never answer "you're on the list" for something that was not saved.
    console.error("[bx] could not save lead", error);
    return NextResponse.json(
      { error: "Could not save that just now. Please call us instead." },
      { status: 500 },
    );
  }
}
