import { slotKey } from "../booking";
import type {
  BookingInput,
  BookingResult,
  BookingRow,
  BookingStore,
  CancelResult,
  RestoreResult,
} from "./types";

/**
 * Supabase store, talked to over PostgREST with plain fetch - no client
 * library needed. Writes go through the book_session function in
 * supabase/schema.sql, which takes an advisory lock so two people cannot
 * both take the last place.
 */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = Boolean(url && key);

function headers() {
  return {
    apikey: key!,
    Authorization: `Bearer ${key!}`,
    "Content-Type": "application/json",
  };
}

export const supabaseStore: BookingStore = {
  name: "supabase",

  async counts(from, to) {
    const query =
      `select=session_id,class_date&class_date=gte.${from}&class_date=lte.${to}` +
      `&cancelled_at=is.null`;
    const res = await fetch(`${url}/rest/v1/bookings?${query}`, {
      headers: headers(),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Supabase counts failed: ${res.status}`);

    const data = (await res.json()) as { session_id: string; class_date: string }[];
    const out: Record<string, number> = {};
    for (const r of data) {
      const k = slotKey(r.session_id, r.class_date);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  },

  async list(from, to): Promise<BookingRow[]> {
    const query =
      `select=id,session_id,class_date,name,phone,created_at,cancelled_at` +
      `&class_date=gte.${from}&class_date=lte.${to}` +
      `&order=class_date.asc,created_at.asc`;

    const res = await fetch(`${url}/rest/v1/bookings?${query}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase list failed: ${res.status}`);

    const data = (await res.json()) as {
      id: string;
      session_id: string;
      class_date: string;
      name: string;
      phone: string;
      created_at: string;
      cancelled_at: string | null;
    }[];

    return data.map((r) => ({
      id: String(r.id),
      sessionId: r.session_id,
      date: r.class_date,
      name: r.name,
      phone: r.phone,
      createdAt: r.created_at,
      cancelledAt: r.cancelled_at,
    }));
  },

  async get(id): Promise<BookingRow | null> {
    const query =
      `select=id,session_id,class_date,name,phone,created_at,cancelled_at` +
      `&id=eq.${encodeURIComponent(id)}&limit=1`;

    const res = await fetch(`${url}/rest/v1/bookings?${query}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase get failed: ${res.status}`);

    const [r] = (await res.json()) as {
      id: string;
      session_id: string;
      class_date: string;
      name: string;
      phone: string;
      created_at: string;
      cancelled_at: string | null;
    }[];

    if (!r) return null;
    return {
      id: String(r.id),
      sessionId: r.session_id,
      date: r.class_date,
      name: r.name,
      phone: r.phone,
      createdAt: r.created_at,
      cancelledAt: r.cancelled_at,
    };
  },

  async cancel(id): Promise<CancelResult> {
    const res = await fetch(
      `${url}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&cancelled_at=is.null`,
      {
        method: "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify({ cancelled_at: new Date().toISOString() }),
      },
    );
    if (!res.ok) throw new Error(`Supabase cancel failed: ${res.status}`);

    const changed = (await res.json()) as unknown[];
    return changed.length > 0 ? { ok: true } : { ok: false, reason: "not-found" };
  },

  async restore(id, capacity): Promise<RestoreResult> {
    // Capacity is re-checked inside the function, for the same reason
    // book_session does it: the place may have gone to someone else.
    const res = await fetch(`${url}/rest/v1/rpc/restore_booking`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_id: id, p_capacity: capacity }),
    });
    if (!res.ok) throw new Error(`Supabase restore failed: ${res.status}`);

    const data = (await res.json()) as { ok: boolean; reason?: "not-found" | "full" };
    return data.ok ? { ok: true } : { ok: false, reason: data.reason ?? "full" };
  },

  async book({ sessionId, date, name, phone, capacity }: BookingInput): Promise<BookingResult> {
    const res = await fetch(`${url}/rest/v1/rpc/book_session`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        p_session_id: sessionId,
        p_date: date,
        p_name: name,
        p_phone: phone,
        p_capacity: capacity,
      }),
    });

    if (!res.ok) throw new Error(`Supabase book failed: ${res.status}`);

    const data = (await res.json()) as {
      ok: boolean;
      reason?: "full" | "duplicate";
      spots_left?: number;
    };

    return data.ok
      ? { ok: true, spotsLeft: data.spots_left ?? 0 }
      : { ok: false, reason: data.reason ?? "full" };
  },
};
