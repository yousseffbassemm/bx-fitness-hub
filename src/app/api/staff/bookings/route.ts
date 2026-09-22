import { NextResponse } from "next/server";
import { capacityFor, findSessionIn } from "@/lib/booking";
import { getSchedule } from "@/lib/content";
import { requireStaff } from "@/lib/staff/guard";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Cancel a booking, or undo a cancellation.
 *
 * Cancelling never deletes the row - it stamps cancelled_at, which frees the
 * place while keeping the record, and is what makes undo possible.
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

  const { id, action } = (body ?? {}) as Record<string, unknown>;

  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Missing booking id" }, { status: 400 });
  }
  if (action !== "cancel" && action !== "restore") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const store = await getStore();

  try {
    if (action === "cancel") {
      const result = await store.cancel(id);
      if (!result.ok) {
        return NextResponse.json(
          { error: "That booking is not there, or was already cancelled." },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Restore needs the capacity of the class the booking belongs to.
    const row = await store.get(id);
    const found = row ? findSessionIn(await getSchedule(), row.sessionId) : null;

    if (!row || !found) {
      return NextResponse.json({ error: "That booking is not there." }, { status: 404 });
    }

    const result = await store.restore(id, capacityFor(found.session.discipline));
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "full"
              ? "The class filled up - that place has gone."
              : "That booking is not there.",
        },
        { status: result.reason === "full" ? 409 : 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[bx] staff booking update failed", error);
    return NextResponse.json({ error: "Could not update that booking." }, { status: 503 });
  }
}
