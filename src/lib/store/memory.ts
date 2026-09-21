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
 * Last-resort store, for a runtime with no filesystem and no Supabase.
 *
 * Bookings live in this process only: they vanish on restart and are not
 * shared between instances. Nothing selects it unless node:sqlite failed to
 * load, and that path logs a warning when it happens.
 */
const rows: BookingRow[] = [];
let nextId = 1;

const live = (sessionId: string, date: string) =>
  rows.filter(
    (r) => r.sessionId === sessionId && r.date === date && r.cancelledAt === null,
  );

export const memoryStore: BookingStore = {
  name: "memory",

  async counts(from, to) {
    const out: Record<string, number> = {};
    for (const r of rows) {
      if (r.date < from || r.date > to || r.cancelledAt !== null) continue;
      const k = slotKey(r.sessionId, r.date);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  },

  async list(from, to) {
    return rows
      .filter((r) => r.date >= from && r.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  },

  async get(id) {
    return rows.find((r) => r.id === id) ?? null;
  },

  async cancel(id): Promise<CancelResult> {
    const row = rows.find((r) => r.id === id && r.cancelledAt === null);
    if (!row) return { ok: false, reason: "not-found" };
    row.cancelledAt = new Date().toISOString();
    return { ok: true };
  },

  async restore(id, capacity): Promise<RestoreResult> {
    const row = rows.find((r) => r.id === id && r.cancelledAt !== null);
    if (!row) return { ok: false, reason: "not-found" };

    if (live(row.sessionId, row.date).length >= capacity) {
      return { ok: false, reason: "full" };
    }
    if (live(row.sessionId, row.date).some((r) => r.phone === row.phone)) {
      return { ok: false, reason: "full" };
    }

    row.cancelledAt = null;
    return { ok: true };
  },

  async book({ sessionId, date, name, phone, capacity }: BookingInput): Promise<BookingResult> {
    const mine = live(sessionId, date);

    if (mine.some((r) => r.phone === phone)) return { ok: false, reason: "duplicate" };
    if (mine.length >= capacity) return { ok: false, reason: "full" };

    rows.push({
      id: String(nextId++),
      sessionId,
      date,
      name,
      phone,
      createdAt: new Date().toISOString(),
      cancelledAt: null,
    });
    return { ok: true, spotsLeft: capacity - mine.length - 1 };
  },
};
