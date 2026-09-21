import { slotKey } from "../booking";
import type { BookingInput, BookingResult, BookingStore } from "./types";

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
    const query = `select=session_id,class_date&class_date=gte.${from}&class_date=lte.${to}`;
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
