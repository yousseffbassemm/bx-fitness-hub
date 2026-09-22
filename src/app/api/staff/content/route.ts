import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/staff/guard";
import { savePlans, type EditablePlan } from "@/lib/content";

export const runtime = "nodejs";

/**
 * Save an editable piece of the site.
 *
 * The marketing page is prerendered, so a save has to tell Next the page is
 * stale - otherwise a price would change in the database and go on showing
 * the old one until the next deploy.
 */
export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { key, value } = (body ?? {}) as Record<string, unknown>;

  if (key !== "plans") {
    return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  }
  if (!Array.isArray(value)) {
    return NextResponse.json({ error: "Expected a list of plans." }, { status: 400 });
  }

  const plans = value as EditablePlan[];

  const blank = plans.find(
    (p) => !String(p?.price ?? "").trim() || !String(p?.period ?? "").trim(),
  );
  if (blank) {
    return NextResponse.json(
      { error: "Every plan needs a price and a period." },
      { status: 400 },
    );
  }

  await savePlans(plans, auth.username);
  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
