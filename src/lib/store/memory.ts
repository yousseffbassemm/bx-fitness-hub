import { slotKey } from "../booking";
import type {
  BookingInput,
  BookingResult,
  BookingRow,
  BookingStore,
  CancelResult,
  LeadInput,
  LeadRow,
  RestoreResult,
  StaffRole,
  StaffUser,
} from "./types";

/**
 * Last-resort store, for a runtime with no filesystem and no Supabase.
 *
 * Bookings live in this process only: they vanish on restart and are not
 * shared between instances. Nothing selects it unless node:sqlite failed to
 * load, and that path logs a warning when it happens.
 */
const rows: BookingRow[] = [];
const leads: LeadRow[] = [];
const staff = new Map<string, StaffUser>();
const content = new Map<string, unknown>();
const uploads = new Map<string, { mime: string; bytes: Uint8Array }>();
let nextId = 1;
let nextLeadId = 1;

const live = (sessionId: string, date: string) =>
  rows.filter(
    (r) => r.sessionId === sessionId && r.date === date && r.cancelledAt === null,
  );

export const memoryStore: BookingStore = {
  name: "memory",

  async findStaffUser(username) {
    return staff.get(username) ?? null;
  },

  async upsertStaffUser(username, passwordHash, role: StaffRole = "staff") {
    const existing = staff.get(username);
    staff.set(username, {
      username,
      role: existing?.role ?? role,
      passwordHash,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastLoginAt: existing?.lastLoginAt ?? null,
    });
  },

  async getContent<T>(key: string) {
    return (content.get(key) as T) ?? null;
  },

  async setContent(key, value) {
    content.set(key, value);
  },

  async saveUpload(id, mime, bytes) {
    uploads.set(id, { mime, bytes });
  },

  async getUpload(id) {
    return uploads.get(id) ?? null;
  },

  async setStaffRole(username, role) {
    const user = staff.get(username);
    if (!user) return false;
    user.role = role;
    return true;
  },

  async listStaffUsers() {
    return [...staff.values()].sort((a, b) => a.username.localeCompare(b.username));
  },

  async touchStaffLogin(username) {
    const user = staff.get(username);
    if (user) user.lastLoginAt = new Date().toISOString();
  },

  async deleteStaffUser(username) {
    return staff.delete(username);
  },

  async saveLead(input: LeadInput) {
    const id = String(nextLeadId++);
    leads.unshift({
      id,
      ...input,
      createdAt: new Date().toISOString(),
      handledAt: null,
    });
    return { ok: true as const, id };
  },

  async listLeads(limit = 200) {
    return leads.slice(0, limit);
  },

  async setLeadHandled(id, handled) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return { ok: false };
    lead.handledAt = handled ? new Date().toISOString() : null;
    return { ok: true };
  },

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
