import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/staff/guard";
import { report } from "@/lib/report";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/*
  The membership list.

  requireStaff rather than requireAdmin: whoever is on the desk is the person
  who signs a new member up and who corrects a number written down wrong.
  Locking it to admins would mean the list only gets tidied when an admin is
  in, which is how a list stops being true.
*/

const MAX_NAME = 80;
const MAX_NUMBER = 40;
const PHONE = /^[+\d][\d\s-]{8,17}$/;

type Fields = { memberNo: string | null; name: string; phone: string };

/** The fields if they are usable, otherwise a message saying which is not. */
function read(body: unknown): Fields | string {
  const { memberNo, name, phone } = (body ?? {}) as Record<string, unknown>;

  const cleanName = typeof name === "string" ? name.trim() : "";
  if (cleanName.length < 2) return "Every member needs a name.";
  if (cleanName.length > MAX_NAME) return "That name is too long.";

  const cleanPhone = typeof phone === "string" ? phone.trim() : "";
  if (!PHONE.test(cleanPhone)) return "That is not a phone number we could call.";

  const cleanNo = typeof memberNo === "string" ? memberNo.trim() : "";
  if (cleanNo.length > MAX_NUMBER) return "That membership number is too long.";

  return { memberNo: cleanNo || null, name: cleanName, phone: cleanPhone };
}

export async function GET(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    return NextResponse.json({ members: await (await getStore()).listMembers() });
  } catch (error) {
    await report("GET /api/staff/members", error);
    return NextResponse.json({ error: "Cannot reach the member list." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const fields = read(body);
  if (typeof fields === "string") return NextResponse.json({ error: fields }, { status: 400 });

  try {
    const result = await (await getStore()).addMember(fields);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Another membership already has that number." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, member: result.member });
  } catch (error) {
    await report("POST /api/staff/members", error);
    return NextResponse.json({ error: "Could not save that member." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id, ended } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "No such member." }, { status: 404 });
  }

  try {
    const store = await getStore();

    // Lapsing and reinstating is its own thing, and carries no other fields.
    if (typeof ended === "boolean") {
      const done = await store.setMemberEnded(id, ended);
      return done
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "No such member." }, { status: 404 });
    }

    const fields = read(body);
    if (typeof fields === "string") return NextResponse.json({ error: fields }, { status: 400 });

    const result = await store.updateMember(id, fields);
    if (!result.ok) {
      return result.reason === "duplicate-number"
        ? NextResponse.json(
            { error: "Another membership already has that number." },
            { status: 409 },
          )
        : NextResponse.json({ error: "No such member." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    await report("PATCH /api/staff/members", error);
    return NextResponse.json({ error: "Could not change that member." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "No such member." }, { status: 404 });
  }

  try {
    const done = await (await getStore()).removeMember(id);
    return done
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "No such member." }, { status: 404 });
  } catch (error) {
    await report("DELETE /api/staff/members", error);
    return NextResponse.json({ error: "Could not remove that member." }, { status: 503 });
  }
}
