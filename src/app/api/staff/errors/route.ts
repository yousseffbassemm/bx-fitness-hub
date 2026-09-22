import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/staff/guard";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  await (await getStore()).clearErrors();
  return NextResponse.json({ ok: true });
}
