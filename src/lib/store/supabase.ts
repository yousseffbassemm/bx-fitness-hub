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
  WaitlistRow,
  ErrorRow,
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

type LeadPayload = {
  id: number;
  name: string;
  phone: string;
  email: string;
  goal: string;
  created_at: string;
  handled_at: string | null;
};

const toLead = (r: LeadPayload): LeadRow => ({
  id: String(r.id),
  name: r.name,
  phone: r.phone,
  email: r.email,
  goal: r.goal,
  createdAt: r.created_at,
  handledAt: r.handled_at,
});

type StaffPayload = {
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
};

const toStaff = (r: StaffPayload): StaffUser => ({
  username: r.username,
  role: r.role === "admin" ? "admin" : "staff",
  passwordHash: r.password_hash,
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

type WaitPayload = {
  id: number;
  session_id: string;
  class_date: string;
  name: string;
  phone: string;
  created_at: string;
  promoted_at: string | null;
};

const toWait = (r: WaitPayload): WaitlistRow => ({
  id: String(r.id),
  sessionId: r.session_id,
  date: r.class_date,
  name: r.name,
  phone: r.phone,
  createdAt: r.created_at,
  promotedAt: r.promoted_at,
});

export const supabaseStore: BookingStore = {
  name: "supabase",

  async getByToken(token) {
    if (!token) return null;
    const res = await fetch(
      `${url}/rest/v1/bookings?select=*&token=eq.${encodeURIComponent(token)}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase getByToken failed: ${res.status}`);
    const [r] = (await res.json()) as Record<string, string | null>[];
    if (!r) return null;
    return {
      id: String(r.id),
      sessionId: r.session_id as string,
      date: r.class_date as string,
      name: r.name as string,
      phone: r.phone as string,
      createdAt: r.created_at as string,
      cancelledAt: r.cancelled_at,
      token: r.token ?? null,
      promotedAt: r.promoted_at ?? null,
    };
  },

  async joinWaitlist({ sessionId, date, name, phone }) {
    const res = await fetch(`${url}/rest/v1/rpc/join_waitlist`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        p_session_id: sessionId,
        p_class_date: date,
        p_name: name,
        p_phone: phone,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase joinWaitlist failed: ${res.status}`);
    const out = (await res.json()) as { ok: boolean; position: number };
    return out.ok
      ? { ok: true as const, position: out.position }
      : { ok: false as const, reason: "duplicate" as const };
  },

  async listWaitlist(from, to) {
    const res = await fetch(
      `${url}/rest/v1/waitlist?select=*&class_date=gte.${from}&class_date=lte.${to}&order=created_at`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase listWaitlist failed: ${res.status}`);
    return ((await res.json()) as WaitPayload[]).map(toWait);
  },

  async promoteFromWaitlist(sessionId, date, capacity) {
    // Behind an advisory lock in SQL, same as book_session: this runs the
    // moment a place frees and must not race someone taking it.
    const res = await fetch(`${url}/rest/v1/rpc/promote_from_waitlist`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        p_session_id: sessionId,
        p_class_date: date,
        p_capacity: capacity,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase promoteFromWaitlist failed: ${res.status}`);
    const out = (await res.json()) as Record<string, string | null> | null;
    if (!out || !out.id) return null;
    return {
      id: String(out.id),
      sessionId: out.session_id as string,
      date: out.class_date as string,
      name: out.name as string,
      phone: out.phone as string,
      createdAt: out.created_at as string,
      cancelledAt: null,
      token: out.token ?? null,
      promotedAt: out.promoted_at ?? null,
    };
  },

  async listPromoted(from, to) {
    const res = await fetch(
      `${url}/rest/v1/bookings?select=*&class_date=gte.${from}&class_date=lte.${to}` +
        `&promoted_at=not.is.null&cancelled_at=is.null&order=class_date`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase listPromoted failed: ${res.status}`);
    return ((await res.json()) as Record<string, string | null>[]).map((r) => ({
      id: String(r.id),
      sessionId: r.session_id as string,
      date: r.class_date as string,
      name: r.name as string,
      phone: r.phone as string,
      createdAt: r.created_at as string,
      cancelledAt: r.cancelled_at,
      token: r.token ?? null,
      promotedAt: r.promoted_at ?? null,
    }));
  },

  async markTold(id) {
    await fetch(`${url}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ promoted_at: null }),
      cache: "no-store",
    });
  },

  async findStaffUser(username) {
    const res = await fetch(
      `${url}/rest/v1/staff_users?select=*&username=eq.${encodeURIComponent(username)}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase findStaffUser failed: ${res.status}`);
    const [row] = (await res.json()) as StaffPayload[];
    return row ? toStaff(row) : null;
  },

  async upsertStaffUser(username, passwordHash, role: StaffRole = "staff") {
    const res = await fetch(`${url}/rest/v1/staff_users`, {
      method: "POST",
      headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ username, password_hash: passwordHash, role }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase upsertStaffUser failed: ${res.status}`);
  },

  async recordError(where, message, detail) {
    await fetch(`${url}/rest/v1/rpc/record_error`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        p_fingerprint: `${where}::${message}`.slice(0, 300),
        p_where: where.slice(0, 120),
        p_message: message.slice(0, 400),
        p_detail: detail?.slice(0, 2000) ?? null,
      }),
      cache: "no-store",
    }).catch(() => {
      // Reporting a failure must never become one.
    });
  },

  async listErrors(limit = 50) {
    const res = await fetch(
      `${url}/rest/v1/errors?select=*&order=last_at.desc&limit=${limit}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase listErrors failed: ${res.status}`);
    return ((await res.json()) as Record<string, string | number | null>[]).map((r) => ({
      id: r.fingerprint as string,
      at: r.last_at as string,
      where: r.where_at as string,
      message: r.message as string,
      detail: (r.detail as string) ?? null,
      count: Number(r.count),
    })) as ErrorRow[];
  },

  async clearErrors() {
    await fetch(`${url}/rest/v1/errors?fingerprint=neq.__none__`, {
      method: "DELETE",
      headers: headers(),
      cache: "no-store",
    });
  },

  async getContent<T>(key: string) {
    const res = await fetch(
      `${url}/rest/v1/site_content?select=value&key=eq.${encodeURIComponent(key)}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase getContent failed: ${res.status}`);
    const [row] = (await res.json()) as { value: unknown }[];
    return row ? (row.value as T) : null;
  },

  async setContent(key, value, editedBy) {
    const res = await fetch(`${url}/rest/v1/site_content`, {
      method: "POST",
      headers: { ...headers(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        key,
        value,
        edited_by: editedBy,
        edited_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase setContent failed: ${res.status}`);
  },

  async saveUpload(id, mime, bytes) {
    // base64 through PostgREST: bytea over JSON has no clean representation,
    // and an image of this size is not worth a second transport for.
    const res = await fetch(`${url}/rest/v1/uploads`, {
      method: "POST",
      headers: { ...headers(), Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        id,
        mime,
        bytes_b64: Buffer.from(bytes).toString("base64"),
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase saveUpload failed: ${res.status}`);
  },

  async getUpload(id) {
    const res = await fetch(
      `${url}/rest/v1/uploads?select=mime,bytes_b64&id=eq.${encodeURIComponent(id)}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase getUpload failed: ${res.status}`);
    const [row] = (await res.json()) as { mime: string; bytes_b64: string }[];
    return row
      ? { mime: row.mime, bytes: new Uint8Array(Buffer.from(row.bytes_b64, "base64")) }
      : null;
  },

  async setStaffRole(username, role) {
    const res = await fetch(
      `${url}/rest/v1/staff_users?username=eq.${encodeURIComponent(username)}`,
      {
        method: "PATCH",
        headers: { ...headers(), Prefer: "return=representation" },
        body: JSON.stringify({ role }),
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`Supabase setStaffRole failed: ${res.status}`);
    return ((await res.json()) as StaffPayload[]).length > 0;
  },

  async listStaffUsers() {
    const res = await fetch(`${url}/rest/v1/staff_users?select=*&order=username`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase listStaffUsers failed: ${res.status}`);
    return ((await res.json()) as StaffPayload[]).map(toStaff);
  },

  async touchStaffLogin(username) {
    await fetch(
      `${url}/rest/v1/staff_users?username=eq.${encodeURIComponent(username)}`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ last_login_at: new Date().toISOString() }),
        cache: "no-store",
      },
    );
  },

  async deleteStaffUser(username) {
    const res = await fetch(
      `${url}/rest/v1/staff_users?username=eq.${encodeURIComponent(username)}`,
      { method: "DELETE", headers: { ...headers(), Prefer: "return=representation" }, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase deleteStaffUser failed: ${res.status}`);
    return ((await res.json()) as StaffPayload[]).length > 0;
  },

  async saveLead(input: LeadInput) {
    const res = await fetch(`${url}/rest/v1/leads`, {
      method: "POST",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase saveLead failed: ${res.status}`);
    const [row] = (await res.json()) as LeadPayload[];
    return { ok: true as const, id: String(row.id) };
  },

  async listLeads(limit = 200) {
    const res = await fetch(
      `${url}/rest/v1/leads?select=*&order=created_at.desc&limit=${limit}`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Supabase listLeads failed: ${res.status}`);
    return ((await res.json()) as LeadPayload[]).map(toLead);
  },

  async setLeadHandled(id, handled) {
    const res = await fetch(`${url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...headers(), Prefer: "return=representation" },
      body: JSON.stringify({ handled_at: handled ? new Date().toISOString() : null }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Supabase setLeadHandled failed: ${res.status}`);
    return { ok: ((await res.json()) as LeadPayload[]).length > 0 };
  },

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
      token?: string | null;
      promoted_at?: string | null;
    }[];

    return data.map((r) => ({
      id: String(r.id),
      sessionId: r.session_id,
      date: r.class_date,
      name: r.name,
      phone: r.phone,
      createdAt: r.created_at,
      cancelledAt: r.cancelled_at,
      token: r.token ?? null,
      promotedAt: r.promoted_at ?? null,
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
      token?: string | null;
      promoted_at?: string | null;
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
      token: r.token ?? null,
      promotedAt: r.promoted_at ?? null,
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
      token?: string;
    };

    return data.ok
      ? { ok: true, spotsLeft: data.spots_left ?? 0, token: data.token ?? "" }
      : { ok: false, reason: data.reason ?? "full" };
  },
};
