import { slotKey } from "../booking";
import type { BookingInput, BookingResult, BookingRow, BookingStore } from "./types";

type Row = { sessionId: string; date: string; name: string; phone: string; createdAt: string };

/**
 * Last-resort store, for a runtime with no filesystem and no Supabase.
 *
 * Bookings live in this process only: they vanish on restart and are not
 * shared between instances. Nothing selects it unless node:sqlite failed to
 * load, and that path logs a warning when it happens.
 */
const rows: Row[] = [];

export const memoryStore: BookingStore = {
  name: "memory",

  async counts(from, to) {
    const out: Record<string, number> = {};
    for (const r of rows) {
      if (r.date < from || r.date > to) continue;
      const k = slotKey(r.sessionId, r.date);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  },

  async list(from, to): Promise<BookingRow[]> {
    return rows
      .filter((r) => r.date >= from && r.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  },

  async book({ sessionId, date, name, phone, capacity }: BookingInput): Promise<BookingResult> {
    const mine = rows.filter((r) => r.sessionId === sessionId && r.date === date);

    if (mine.some((r) => r.phone === phone)) return { ok: false, reason: "duplicate" };
    if (mine.length >= capacity) return { ok: false, reason: "full" };

    rows.push({ sessionId, date, name, phone, createdAt: new Date().toISOString() });
    return { ok: true, spotsLeft: capacity - mine.length - 1 };
  },
};
