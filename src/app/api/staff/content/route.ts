import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/staff/guard";
import {
  saveCoaches,
  saveFacilities,
  saveGallery,
  savePlans,
  saveSchedule,
  type EditableCoach,
  type EditableFacility,
  type EditableGalleryItem,
  type EditablePlan,
  type ScheduleDay,
} from "@/lib/content";

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

  if (!Array.isArray(value)) {
    return NextResponse.json({ error: "Expected a list." }, { status: 400 });
  }

  if (key === "plans") {
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
  } else if (key === "coaches") {
    const coaches = value as EditableCoach[];

    if (coaches.length === 0) {
      return NextResponse.json(
        { error: "Keep at least one coach - an empty section looks broken." },
        { status: 400 },
      );
    }
    const nameless = coaches.find((c) => !String(c?.name ?? "").trim());
    if (nameless) {
      return NextResponse.json({ error: "Every coach needs a name." }, { status: 400 });
    }
    const unphotographed = coaches.find(
      (c) => !c?.photoId && !String(c?.name ?? "").trim(),
    );
    if (unphotographed) {
      return NextResponse.json({ error: "Every coach needs a photo." }, { status: 400 });
    }

    await saveCoaches(coaches, auth.username);
  } else if (key === "schedule") {
    const days = value as ScheduleDay[];

    if (days.length !== 7) {
      return NextResponse.json(
        { error: "The timetable is seven days." },
        { status: 400 },
      );
    }

    for (const day of days) {
      for (const s of day.sessions ?? []) {
        if (!String(s?.time ?? "").trim() || !String(s?.discipline ?? "").trim()) {
          return NextResponse.json(
            { error: "Every class needs a time and a name." },
            { status: 400 },
          );
        }
      }
    }

    await saveSchedule(days, auth.username);
  } else if (key === "facilities") {
    const items = value as EditableFacility[];
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Keep at least one - an empty section looks broken." },
        { status: 400 },
      );
    }
    if (items.some((f) => !String(f?.title ?? "").trim())) {
      return NextResponse.json({ error: "Every facility needs a name." }, { status: 400 });
    }
    await saveFacilities(items, auth.username);
  } else if (key === "gallery") {
    const items = value as EditableGalleryItem[];
    if (items.length === 0) {
      return NextResponse.json(
        { error: "Keep at least one photo." },
        { status: 400 },
      );
    }
    await saveGallery(items, auth.username);
  } else {
    return NextResponse.json({ error: "Unknown section." }, { status: 400 });
  }

  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
