import { NextResponse } from "next/server";
import { report } from "@/lib/report";
import { requireStaff } from "@/lib/staff/guard";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Tick an enquiry off, or put it back on the list.
 *
 * Nothing here deletes anything: "handled" is a timestamp, so a row ticked off
 * by mistake comes straight back, and the record of who asked is kept either
 * way.
 */
export async function PATCH(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id, handled } = (body ?? {}) as Record<string, unknown>;

  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Missing enquiry id" }, { status: 400 });
  }
  if (typeof handled !== "boolean") {
    return NextResponse.json({ error: "Missing handled flag" }, { status: 400 });
  }

  /*
    Enquiry ids are whole numbers in both stores. Without this check an id
    of any other shape reached Postgres, which refused it, and the store
    threw - the only route here that let an exception out as a bare 500
    with nothing written to Problems.
  */
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "That enquiry is gone" }, { status: 404 });
  }

  try {
    const result = await (await getStore()).setLeadHandled(id, handled);
    if (!result.ok) {
      return NextResponse.json({ error: "That enquiry is gone" }, { status: 404 });
    }
  } catch (error) {
    await report("PATCH /api/staff/leads", error, `lead ${id}`);
    return NextResponse.json(
      { error: "Could not update that enquiry just now." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
