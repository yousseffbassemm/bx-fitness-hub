import { NextResponse } from "next/server";
import { LIMITS, allow, callerKey, tooManyMessage } from "@/lib/rate-limit";
import { report } from "@/lib/report";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * "Is this a membership?" - asked by the booking dialog before it asks for
 * anything else.
 *
 * Deliberately says as little as it can. It answers with a first name and
 * nothing else: enough for a member to see they typed their own number and
 * not somebody else's, and not enough to be worth harvesting. No phone, no
 * membership number, no surname, nothing about what they pay.
 *
 * Rate limited on the same budget as booking, because the one thing this
 * shape of endpoint invites is somebody walking through phone numbers to
 * see which ones come back. A real member asks once.
 */
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

  const reference = String((body as { reference?: unknown })?.reference ?? "").trim();
  if (!reference || reference.length > 64) {
    return NextResponse.json(
      { found: false, error: "Give your membership number or the phone number we have for you." },
      { status: 400 },
    );
  }

  try {
    const result = await (await getStore()).findMember(reference);

    if (result.found) {
      return NextResponse.json({ found: true, firstName: result.member.name.split(/\s+/)[0] });
    }

    if (result.reason === "ambiguous") {
      return NextResponse.json({
        found: false,
        reason: "ambiguous",
        error: "More than one membership uses that number. Please use your membership number.",
      });
    }

    return NextResponse.json({
      found: false,
      reason: "unknown",
      error: "We cannot find that. Check the number, or book as a guest and the desk will sort it out.",
    });
  } catch (error) {
    await report("POST /api/members/lookup", error);
    return NextResponse.json(
      { found: false, error: "Cannot check memberships just now. Book as a guest, or call us." },
      { status: 503 },
    );
  }
}
