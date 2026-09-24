import { slotKey } from "../booking";
import type {
  BookingInput,
  BookingResult,
  BookingRow,
  BookingStore,
  CancelResult,
  LeadInput,
  LeadRow,
  Member,
  MemberInput,
  RestoreResult,
  StaffRole,
  StaffUser,
  WaitlistRow,
  ErrorRow,
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
const errors = new Map<string, ErrorRow>();
const waiting: WaitlistRow[] = [];
const members: Member[] = [];
let nextWaitId = 1;
let nextMemberId = 1;

/** Membership numbers are compared ignoring case and surrounding space. */
const tidyNo = (value: string | null | undefined) => String(value ?? "").trim();
const sameNo = (a: string | null, b: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
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

  async recordError(where, message, detail) {
    const id = `${where}::${message}`;
    const seen = errors.get(id);
    errors.set(id, {
      id,
      at: new Date().toISOString(),
      where,
      message,
      detail: detail ?? seen?.detail ?? null,
      count: (seen?.count ?? 0) + 1,
    });
  },

  async listErrors(limit = 50) {
    return [...errors.values()]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  },

  async clearErrors() {
    errors.clear();
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

  async getByToken(t) {
    return rows.find((r) => r.token === t) ?? null;
  },

  async joinWaitlist({ sessionId, date, name, phone, memberId = null, payment = null }) {
    // The same split as booking: a membership queues once, a guest phone
    // queues once, and neither stands in for the other.
    const already = waiting.some(
      (w) =>
        w.sessionId === sessionId &&
        w.date === date &&
        w.promotedAt === null &&
        (memberId ? w.memberId === memberId : w.memberId === null && w.phone === phone),
    );
    if (already) return { ok: false as const, reason: "duplicate" as const };

    waiting.push({
      id: String(nextWaitId++),
      sessionId,
      date,
      name,
      phone,
      createdAt: new Date().toISOString(),
      promotedAt: null,
      memberId,
      payment,
    });

    return {
      ok: true as const,
      position: waiting.filter(
        (w) => w.sessionId === sessionId && w.date === date && w.promotedAt === null,
      ).length,
    };
  },

  async listWaitlist(from, to) {
    return waiting.filter((w) => w.date >= from && w.date <= to);
  },

  async promoteFromWaitlist(sessionId, date, capacity) {
    if (live(sessionId, date).length >= capacity) return null;
    const next = waiting.find(
      (w) => w.sessionId === sessionId && w.date === date && w.promotedAt === null,
    );
    if (!next) return null;

    next.promotedAt = new Date().toISOString();
    const row: BookingRow = {
      id: String(nextId++),
      sessionId,
      date,
      name: next.name,
      phone: next.phone,
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      token: token(),
      promotedAt: new Date().toISOString(),
      // Whoever joined the queue as a member comes off it as one.
      memberId: next.memberId,
      memberNo: members.find((m) => m.id === next.memberId)?.memberNo ?? null,
      payment: next.payment,
      paidAt: null,
    };
    rows.push(row);
    return row;
  },

  async listPromoted(from, to) {
    return rows.filter(
      (r) =>
        r.date >= from && r.date <= to && r.promotedAt !== null && r.cancelledAt === null,
    );
  },

  async setPaid(id, paid) {
    const row = rows.find((r) => r.id === id);
    // A member has nothing to pay, so there is nothing to tick off.
    if (!row || row.memberId) return false;
    row.paidAt = paid ? new Date().toISOString() : null;
    return true;
  },

  async markTold(id) {
    const row = rows.find((r) => r.id === id);
    if (row) row.promotedAt = null;
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

  async book({
    sessionId,
    date,
    name,
    phone,
    capacity,
    memberId = null,
    payment = null,
  }: BookingInput): Promise<BookingResult> {
    const mine = live(sessionId, date);

    /*
      One place per person, where "person" is the membership if there is one.
      Two memberships on one phone is a Couples & Friends plan, so matching
      on the phone alone refused the second of a couple as a duplicate of
      the first.
    */
    const already = memberId
      ? mine.some((r) => r.memberId === memberId)
      : mine.some((r) => r.memberId === null && r.payment !== null && r.phone === phone);
    if (already) return { ok: false, reason: "duplicate" };
    if (mine.length >= capacity) return { ok: false, reason: "full" };

    const mineToken = token();
    rows.push({
      id: String(nextId++),
      sessionId,
      date,
      name,
      phone,
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      token: mineToken,
      promotedAt: null,
      memberId,
      memberNo: members.find((m) => m.id === memberId)?.memberNo ?? null,
      payment,
      paidAt: null,
    });
    return { ok: true, spotsLeft: capacity - mine.length - 1, token: mineToken };
  },

  async findMember(reference) {
    const wanted = tidyNo(reference);
    if (!wanted) return { found: false, reason: "unknown" };

    const active = members.filter((m) => m.endedAt === null);
    const byNumber = active.find((m) => sameNo(m.memberNo, wanted));
    if (byNumber) return { found: true, member: { ...byNumber } };

    // Two people on one number is a Couples & Friends membership, not a
    // mistake, so this asks for the number rather than picking one.
    const byPhone = active.filter((m) => m.phone === wanted);
    if (byPhone.length === 1) return { found: true, member: { ...byPhone[0] } };
    if (byPhone.length > 1) return { found: false, reason: "ambiguous" };

    return { found: false, reason: "unknown" };
  },

  async listMembers() {
    return members
      .map((m) => ({ ...m }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async addMember({ memberNo, name, phone }: MemberInput) {
    const no = tidyNo(memberNo) || null;
    if (no && members.some((m) => sameNo(m.memberNo, no))) {
      return { ok: false as const, reason: "duplicate-number" as const };
    }

    const member: Member = {
      id: `m${nextMemberId++}`,
      memberNo: no,
      name: name.trim(),
      phone: phone.trim(),
      createdAt: new Date().toISOString(),
      endedAt: null,
    };
    members.push(member);
    return { ok: true as const, member: { ...member } };
  },

  async updateMember(id, { memberNo, name, phone }: MemberInput) {
    const member = members.find((m) => m.id === id);
    if (!member) return { ok: false as const, reason: "not-found" as const };

    const no = tidyNo(memberNo) || null;
    if (no && members.some((m) => m.id !== id && sameNo(m.memberNo, no))) {
      return { ok: false as const, reason: "duplicate-number" as const };
    }

    member.memberNo = no;
    member.name = name.trim();
    member.phone = phone.trim();
    return { ok: true as const };
  },

  async setMemberEnded(id, ended) {
    const member = members.find((m) => m.id === id);
    if (!member) return false;
    member.endedAt = ended ? new Date().toISOString() : null;
    return true;
  },

  async removeMember(id) {
    const at = members.findIndex((m) => m.id === id);
    if (at === -1) return false;
    members.splice(at, 1);
    // The bookings keep their name and phone; only the link goes.
    for (const row of rows) if (row.memberId === id) row.memberId = null;
    return true;
  },
};
