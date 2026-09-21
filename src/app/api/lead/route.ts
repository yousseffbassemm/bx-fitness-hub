import { NextResponse } from "next/server";

/**
 * Lead capture endpoint.
 *
 * TODO: wire this to wherever BX wants enquiries to land - an inbox, a sheet,
 * or the CRM. Right now it validates the payload and logs it server-side so
 * the form is functional end to end without inventing an integration.
 */
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

  console.info("[bx] new lead", { name, phone, email, goal });

  return NextResponse.json({ ok: true });
}
