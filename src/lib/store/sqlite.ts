import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
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
  RestoreResult,
  StaffRole,
  StaffUser,
  WaitlistRow,
} from "./types";

/**
 * Bookings on disk, using Node's built-in SQLite - no dependency to install
 * and nothing to sign up for. This is the default store, so a fresh clone
 * takes real bookings that survive a restart.
 *
 * It is the right store for a single server. It is the wrong one for
 * serverless or more than one instance, because each instance would own a
 * separate file: set the Supabase environment variables for that and the
 * Supabase store takes over.
 */
const file =
  process.env.BOOKINGS_DB_PATH ?? path.join(process.cwd(), ".data", "bookings.db");

let db: DatabaseSync | null = null;

/**
 * Cancelling keeps the row and stamps cancelled_at, so a member's record is
 * never silently erased. That means "one place per phone" has to be a
 * partial index over live rows only - otherwise someone who was cancelled
 * could never rebook.
 */
function migrate(next: DatabaseSync) {
  const columns = next.prepare("PRAGMA table_info(bookings)").all() as {
    name: string;
  }[];

  if (columns.length === 0) {
    next.exec(`
      CREATE TABLE bookings (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id   TEXT NOT NULL,
        class_date   TEXT NOT NULL,
        name         TEXT NOT NULL,
        phone        TEXT NOT NULL,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        cancelled_at TEXT
      )
    `);
  } else if (!columns.some((c) => c.name === "cancelled_at")) {
    // The old table carried a table-level UNIQUE, which SQLite will not let
    // us drop, so the table is rebuilt rather than altered.
    next.exec("BEGIN IMMEDIATE");
    try {
      next.exec(`
        CREATE TABLE bookings_new (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id   TEXT NOT NULL,
          class_date   TEXT NOT NULL,
          name         TEXT NOT NULL,
          phone        TEXT NOT NULL,
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          cancelled_at TEXT
        )
      `);
      next.exec(`
        INSERT INTO bookings_new (id, session_id, class_date, name, phone, created_at)
        SELECT id, session_id, class_date, name, phone, created_at FROM bookings
      `);
      next.exec("DROP TABLE bookings");
      next.exec("ALTER TABLE bookings_new RENAME TO bookings");
      next.exec("COMMIT");
    } catch (error) {
      next.exec("ROLLBACK");
      throw error;
    }
  }

  // Enquiries from the "Start here" form. No unique constraint: the same
  // person asking twice is two enquiries, and losing the second one because
  // it looks like the first is exactly the failure this table exists to end.
  next.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT NOT NULL,
      email      TEXT NOT NULL,
      goal       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      handled_at TEXT
    )
  `);
  next.exec("CREATE INDEX IF NOT EXISTS leads_created_idx ON leads (created_at DESC)");

  // Staff accounts. One row per person, so a sign-in is attributable and
  // removing someone does not mean changing a password everyone else shares.
  next.exec(`
    CREATE TABLE IF NOT EXISTS staff_users (
      username      TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'staff',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    )
  `);

  // Accounts that predate roles: add the column, then make them admins. They
  // were created when every account could do everything, and silently
  // demoting them would lock the team out of its own account management.
  const staffColumns = next.prepare("PRAGMA table_info(staff_users)").all() as {
    name: string;
  }[];
  if (!staffColumns.some((c) => c.name === "role")) {
    next.exec("ALTER TABLE staff_users ADD COLUMN role TEXT NOT NULL DEFAULT 'staff'");
    next.exec("UPDATE staff_users SET role = 'admin'");
  }

  // Never leave nobody in charge: if every admin has been removed or demoted,
  // the longest-standing account takes it back.
  const admins = next
    .prepare("SELECT COUNT(*) AS n FROM staff_users WHERE role = 'admin'")
    .get() as { n: number };
  if (Number(admins.n) === 0) {
    next.exec(`
      UPDATE staff_users SET role = 'admin'
       WHERE username = (SELECT username FROM staff_users ORDER BY created_at, username LIMIT 1)
    `);
  }

  // Editable pieces of the site, as JSON. edited_by and edited_at are there
  // so a change that surprises someone can be traced to a person and a time.
  next.exec(`
    CREATE TABLE IF NOT EXISTS site_content (
      key       TEXT PRIMARY KEY,
      value     TEXT NOT NULL,
      edited_by TEXT NOT NULL,
      edited_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Uploaded images. id is a content hash, so re-uploading the same file
  // lands on the same row and the URL can be cached indefinitely.
  next.exec(`
    CREATE TABLE IF NOT EXISTS uploads (
      id         TEXT PRIMARY KEY,
      mime       TEXT NOT NULL,
      bytes      BLOB NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // The member's own handle on a booking, and whether they still need
  // telling that a waitlist place came free. Added rather than rebuilt: the
  // bookings already in here are real.
  const bookingCols = next.prepare("PRAGMA table_info(bookings)").all() as {
    name: string;
  }[];
  if (!bookingCols.some((c) => c.name === "token")) {
    next.exec("ALTER TABLE bookings ADD COLUMN token TEXT");
    next.exec("CREATE UNIQUE INDEX IF NOT EXISTS bookings_token_idx ON bookings (token)");
  }
  if (!bookingCols.some((c) => c.name === "promoted_at")) {
    next.exec("ALTER TABLE bookings ADD COLUMN promoted_at TEXT");
  }

  /*
    Members.

    Classes are open to members and to anyone off the street, and the two
    are not the same at the desk: a member's place is part of what they
    already pay for, a guest pays for the class.

    phone is deliberately not unique - BX sells a Couples & Friends
    membership, and two people on one number is what that is.
  */
  next.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id         TEXT PRIMARY KEY,
      member_no  TEXT,
      name       TEXT NOT NULL,
      phone      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at   TEXT
    )
  `);
  next.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS members_no_idx
      ON members (lower(trim(member_no)))
      WHERE member_no IS NOT NULL AND trim(member_no) <> ''
  `);
  next.exec("CREATE INDEX IF NOT EXISTS members_phone_idx ON members (phone)");

  // Who a booking belongs to, and how a guest said they would pay.
  if (!bookingCols.some((c) => c.name === "member_id")) {
    next.exec("ALTER TABLE bookings ADD COLUMN member_id TEXT");
    next.exec("CREATE INDEX IF NOT EXISTS bookings_member_idx ON bookings (member_id)");
  }
  if (!bookingCols.some((c) => c.name === "payment")) {
    next.exec("ALTER TABLE bookings ADD COLUMN payment TEXT");
  }
  // What they said they would do is not the same as what happened.
  if (!bookingCols.some((c) => c.name === "paid_at")) {
    next.exec("ALTER TABLE bookings ADD COLUMN paid_at TEXT");
  }

  // People waiting for a class that was full. One live entry per phone per
  // slot, same rule as bookings, for the same reason.
  next.exec(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT NOT NULL,
      class_date   TEXT NOT NULL,
      name         TEXT NOT NULL,
      phone        TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      promoted_at  TEXT
    )
  `);
  // Carried through promotion, so somebody who joined the queue as a member
  // does not come off it as a guest and get asked to pay.
  const waitCols = next.prepare("PRAGMA table_info(waitlist)").all() as { name: string }[];
  if (!waitCols.some((c) => c.name === "member_id")) {
    next.exec("ALTER TABLE waitlist ADD COLUMN member_id TEXT");
  }
  if (!waitCols.some((c) => c.name === "payment")) {
    next.exec("ALTER TABLE waitlist ADD COLUMN payment TEXT");
  }
  // The same split for the queue, for the same reason.
  next.exec("DROP INDEX IF EXISTS waitlist_live_unique");
  next.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS waitlist_live_member_unique
      ON waitlist (session_id, class_date, member_id)
      WHERE promoted_at IS NULL AND member_id IS NOT NULL
  `);
  next.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS waitlist_live_guest_unique
      ON waitlist (session_id, class_date, phone)
      WHERE promoted_at IS NULL AND member_id IS NULL
  `);
  next.exec("CREATE INDEX IF NOT EXISTS waitlist_date_idx ON waitlist (class_date)");

  // Server-side failures, grouped. fingerprint is where + message, so a
  // loop of the same error is one row with a rising count rather than a
  // table nobody can read.
  next.exec(`
    CREATE TABLE IF NOT EXISTS errors (
      fingerprint TEXT PRIMARY KEY,
      where_at    TEXT NOT NULL,
      message     TEXT NOT NULL,
      detail      TEXT,
      count       INTEGER NOT NULL DEFAULT 1,
      last_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  next.exec("CREATE INDEX IF NOT EXISTS bookings_date_idx ON bookings (class_date)");
  /*
    One place per person, where "person" is the membership if there is one.
    The old rule matched on the phone alone, which is right for guests and
    wrong for members: BX sells a Couples & Friends plan, so two memberships
    on one number is what that plan is, and the second of a couple was
    refused as a duplicate of the first.
  */
  next.exec("DROP INDEX IF EXISTS bookings_live_unique");
  next.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_live_member_unique
      ON bookings (session_id, class_date, member_id)
      WHERE cancelled_at IS NULL AND member_id IS NOT NULL
  `);
  next.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_live_guest_unique
      ON bookings (session_id, class_date, phone)
      WHERE cancelled_at IS NULL AND member_id IS NULL
  `);
}

function open() {
  if (db) return db;

  mkdirSync(path.dirname(file), { recursive: true });
  const next = new DatabaseSync(file);

  // WAL lets reads carry on while a booking is being written.
  next.exec("PRAGMA journal_mode = WAL");
  // Wait rather than fail if another request holds the write lock.
  next.exec("PRAGMA busy_timeout = 5000");
  migrate(next);

  db = next;
  return db;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

type BookingDbRow = {
  id: number;
  session_id: string;
  class_date: string;
  name: string;
  phone: string;
  created_at: string;
  cancelled_at: string | null;
  token: string | null;
  promoted_at: string | null;
  member_id: string | null;
  member_no: string | null;
  payment: string | null;
  paid_at: string | null;
};

/*
  The membership number comes from a join, not from the booking, so a number
  corrected on the Members screen reads correctly on an old class list. The
  name and phone on the booking are left alone - those are who turned up.
*/
const BOOKING_COLUMNS =
  "b.id, b.session_id, b.class_date, b.name, b.phone, b.created_at, b.cancelled_at, " +
  "b.token, b.promoted_at, b.member_id, b.payment, b.paid_at, m.member_no";

const BOOKING_FROM = "bookings b LEFT JOIN members m ON m.id = b.member_id";

type MemberDbRow = {
  id: string;
  member_no: string | null;
  name: string;
  phone: string;
  created_at: string;
  ended_at: string | null;
};

const MEMBER_COLUMNS = "id, member_no, name, phone, created_at, ended_at";

/** A blank membership number is no number, not an empty one. */
const tidy = (value: string | null | undefined) => String(value ?? "").trim() || null;

const toMember = (r: MemberDbRow): Member => ({
  id: r.id,
  memberNo: r.member_no,
  name: r.name,
  phone: r.phone,
  createdAt: r.created_at,
  endedAt: r.ended_at,
});

const toBooking = (r: BookingDbRow): BookingRow => ({
  id: String(r.id),
  sessionId: r.session_id,
  date: r.class_date,
  name: r.name,
  phone: r.phone,
  createdAt: r.created_at,
  cancelledAt: r.cancelled_at,
  token: r.token,
  promotedAt: r.promoted_at,
  memberId: r.member_id,
  memberNo: r.member_no,
  payment: (r.payment as BookingRow["payment"]) ?? null,
  paidAt: r.paid_at,
});

/** The member's handle on their booking. Long enough not to be guessed. */
const newToken = () => randomBytes(16).toString("hex");

function liveCount(d: DatabaseSync, sessionId: string, date: string) {
  const { n } = d
    .prepare(
      `SELECT COUNT(*) AS n FROM bookings
        WHERE session_id = ? AND class_date = ? AND cancelled_at IS NULL`,
    )
    .get(sessionId, date) as { n: number };
  return Number(n);
}

function toLead(r: {
  id: number;
  name: string;
  phone: string;
  email: string;
  goal: string;
  created_at: string;
  handled_at: string | null;
}): LeadRow {
  return {
    id: String(r.id),
    name: r.name,
    phone: r.phone,
    email: r.email,
    goal: r.goal,
    createdAt: r.created_at,
    handledAt: r.handled_at,
  };
}

type StaffRow = {
  username: string;
  password_hash: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
};

const toStaff = (r: StaffRow): StaffUser => ({
  username: r.username,
  role: r.role === "admin" ? "admin" : "staff",
  passwordHash: r.password_hash,
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

export const sqliteStore: BookingStore = {
  name: "sqlite",

  async findStaffUser(username) {
    const row = open()
      .prepare("SELECT * FROM staff_users WHERE username = ?")
      .get(username) as StaffRow | undefined;
    return row ? toStaff(row) : null;
  },

  async upsertStaffUser(username, passwordHash, role: StaffRole = "staff") {
    open()
      .prepare(
        `INSERT INTO staff_users (username, password_hash, role) VALUES (?, ?, ?)
         ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`,
      )
      .run(username, passwordHash, role);
  },

  async recordError(where, message, detail) {
    const fingerprint = `${where}::${message}`.slice(0, 300);
    open()
      .prepare(
        `INSERT INTO errors (fingerprint, where_at, message, detail)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(fingerprint) DO UPDATE SET
           count = count + 1,
           last_at = datetime('now'),
           detail = COALESCE(excluded.detail, errors.detail)`,
      )
      .run(fingerprint, where.slice(0, 120), message.slice(0, 400), detail?.slice(0, 2000) ?? null);
  },

  async listErrors(limit = 50) {
    const rows = open()
      .prepare(
        `SELECT fingerprint, where_at, message, detail, count, last_at
           FROM errors ORDER BY datetime(last_at) DESC LIMIT ?`,
      )
      .all(limit) as {
      fingerprint: string;
      where_at: string;
      message: string;
      detail: string | null;
      count: number;
      last_at: string;
    }[];

    return rows.map((r) => ({
      id: r.fingerprint,
      at: r.last_at,
      where: r.where_at,
      message: r.message,
      detail: r.detail,
      count: Number(r.count),
    }));
  },

  async clearErrors() {
    open().prepare("DELETE FROM errors").run();
  },

  async getContent<T>(key: string) {
    const row = open()
      .prepare("SELECT value FROM site_content WHERE key = ?")
      .get(key) as { value: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      // Unparseable content should not take the page down with it.
      return null;
    }
  },

  async setContent(key, value, editedBy) {
    open()
      .prepare(
        `INSERT INTO site_content (key, value, edited_by, edited_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           edited_by = excluded.edited_by,
           edited_at = excluded.edited_at`,
      )
      .run(key, JSON.stringify(value), editedBy);
  },

  async saveUpload(id, mime, bytes) {
    open()
      .prepare("INSERT OR IGNORE INTO uploads (id, mime, bytes) VALUES (?, ?, ?)")
      .run(id, mime, bytes);
  },

  async getUpload(id) {
    const row = open()
      .prepare("SELECT mime, bytes FROM uploads WHERE id = ?")
      .get(id) as { mime: string; bytes: Uint8Array } | undefined;
    return row ? { mime: row.mime, bytes: new Uint8Array(row.bytes) } : null;
  },

  async setStaffRole(username, role) {
    const info = open()
      .prepare("UPDATE staff_users SET role = ? WHERE username = ?")
      .run(role, username);
    return Number(info.changes) > 0;
  },

  async listStaffUsers() {
    const rows = open()
      .prepare("SELECT * FROM staff_users ORDER BY username")
      .all() as StaffRow[];
    return rows.map(toStaff);
  },

  async touchStaffLogin(username) {
    open()
      .prepare("UPDATE staff_users SET last_login_at = datetime('now') WHERE username = ?")
      .run(username);
  },

  async deleteStaffUser(username) {
    const info = open()
      .prepare("DELETE FROM staff_users WHERE username = ?")
      .run(username);
    return Number(info.changes) > 0;
  },

  async saveLead(input: LeadInput) {
    const info = open()
      .prepare("INSERT INTO leads (name, phone, email, goal) VALUES (?, ?, ?, ?)")
      .run(input.name, input.phone, input.email, input.goal);
    return { ok: true as const, id: String(info.lastInsertRowid) };
  },

  async listLeads(limit = 200) {
    const rows = open()
      .prepare(
        `SELECT id, name, phone, email, goal, created_at, handled_at
           FROM leads
          ORDER BY datetime(created_at) DESC, id DESC
          LIMIT ?`,
      )
      .all(limit) as Parameters<typeof toLead>[0][];
    return rows.map(toLead);
  },

  async setLeadHandled(id, handled) {
    const info = open()
      .prepare(
        handled
          ? "UPDATE leads SET handled_at = datetime('now') WHERE id = ?"
          : "UPDATE leads SET handled_at = NULL WHERE id = ?",
      )
      .run(id);
    return { ok: Number(info.changes) > 0 };
  },

  async counts(from, to) {
    const rows = open()
      .prepare(
        `SELECT session_id, class_date, COUNT(*) AS n
           FROM bookings
          WHERE class_date BETWEEN ? AND ?
            AND cancelled_at IS NULL
          GROUP BY session_id, class_date`,
      )
      .all(from, to) as { session_id: string; class_date: string; n: number }[];

    const out: Record<string, number> = {};
    for (const r of rows) out[slotKey(r.session_id, r.class_date)] = Number(r.n);
    return out;
  },

  async list(from, to): Promise<BookingRow[]> {
    const rows = open()
      .prepare(
        `SELECT ${BOOKING_COLUMNS}
           FROM ${BOOKING_FROM}
          WHERE b.class_date BETWEEN ? AND ?
          ORDER BY b.class_date ASC, b.created_at ASC`,
      )
      .all(from, to) as BookingDbRow[];

    return rows.map(toBooking);
  },

  async get(id): Promise<BookingRow | null> {
    const r = open()
      .prepare(`SELECT ${BOOKING_COLUMNS} FROM ${BOOKING_FROM} WHERE b.id = ?`)
      .get(id) as BookingDbRow | undefined;
    return r ? toBooking(r) : null;
  },

  async getByToken(token): Promise<BookingRow | null> {
    if (!token) return null;
    const r = open()
      .prepare(`SELECT ${BOOKING_COLUMNS} FROM ${BOOKING_FROM} WHERE b.token = ?`)
      .get(token) as BookingDbRow | undefined;
    return r ? toBooking(r) : null;
  },

  async cancel(id): Promise<CancelResult> {
    const result = open()
      .prepare(
        "UPDATE bookings SET cancelled_at = datetime('now') WHERE id = ? AND cancelled_at IS NULL",
      )
      .run(id);

    return Number(result.changes) > 0 ? { ok: true } : { ok: false, reason: "not-found" };
  },

  async restore(id, capacity): Promise<RestoreResult> {
    const d = open();

    d.exec("BEGIN IMMEDIATE");
    try {
      const row = d
        .prepare(
          "SELECT session_id, class_date FROM bookings WHERE id = ? AND cancelled_at IS NOT NULL",
        )
        .get(id) as { session_id: string; class_date: string } | undefined;

      if (!row) {
        d.exec("ROLLBACK");
        return { ok: false, reason: "not-found" };
      }

      // The place may well have gone to someone else in the meantime.
      if (liveCount(d, row.session_id, row.class_date) >= capacity) {
        d.exec("ROLLBACK");
        return { ok: false, reason: "full" };
      }

      d.prepare("UPDATE bookings SET cancelled_at = NULL WHERE id = ?").run(id);
      d.exec("COMMIT");
      return { ok: true };
    } catch (error) {
      d.exec("ROLLBACK");
      // Someone rebooked with the same number while it was cancelled.
      if (isUniqueViolation(error)) return { ok: false, reason: "full" };
      throw error;
    }
  },

  /* ---------------------------------------------------------------- */
  /* Waitlist                                                          */

  async joinWaitlist({ sessionId, date, name, phone, memberId = null, payment = null }) {
    const d = open();
    try {
      d.prepare(
        `INSERT INTO waitlist (session_id, class_date, name, phone, member_id, payment)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(sessionId, date, name, phone, memberId, payment);
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false as const, reason: "duplicate" as const };
      throw error;
    }

    const { n } = d
      .prepare(
        `SELECT COUNT(*) AS n FROM waitlist
          WHERE session_id = ? AND class_date = ? AND promoted_at IS NULL`,
      )
      .get(sessionId, date) as { n: number };

    return { ok: true as const, position: Number(n) };
  },

  async listWaitlist(from, to): Promise<WaitlistRow[]> {
    const rows = open()
      .prepare(
        `SELECT id, session_id, class_date, name, phone, created_at, promoted_at,
                member_id, payment
           FROM waitlist
          WHERE class_date BETWEEN ? AND ?
          ORDER BY datetime(created_at), id`,
      )
      .all(from, to) as {
      id: number;
      session_id: string;
      class_date: string;
      name: string;
      phone: string;
      created_at: string;
      promoted_at: string | null;
      member_id: string | null;
      payment: string | null;
    }[];

    return rows.map((r) => ({
      id: String(r.id),
      sessionId: r.session_id,
      date: r.class_date,
      name: r.name,
      phone: r.phone,
      createdAt: r.created_at,
      promotedAt: r.promoted_at,
      memberId: r.member_id,
      payment: (r.payment as WaitlistRow["payment"]) ?? null,
    }));
  },

  /**
   * Move the longest-waiting person into the freed place.
   *
   * Under the same write lock as a booking, because this runs the moment a
   * place frees and must not race a member taking that place themselves -
   * otherwise a class can end up one over capacity.
   */
  async promoteFromWaitlist(sessionId, date, capacity): Promise<BookingRow | null> {
    const d = open();

    d.exec("BEGIN IMMEDIATE");
    try {
      if (liveCount(d, sessionId, date) >= capacity) {
        d.exec("ROLLBACK");
        return null;
      }

      const next = d
        .prepare(
          `SELECT id, name, phone, member_id, payment FROM waitlist
            WHERE session_id = ? AND class_date = ? AND promoted_at IS NULL
            ORDER BY datetime(created_at), id
            LIMIT 1`,
        )
        .get(sessionId, date) as
        | { id: number; name: string; phone: string; member_id: string | null; payment: string | null }
        | undefined;

      if (!next) {
        d.exec("ROLLBACK");
        return null;
      }

      const token = newToken();
      const info = d
        .prepare(
          `INSERT INTO bookings
             (session_id, class_date, name, phone, token, promoted_at, member_id, payment)
           VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
        )
        .run(sessionId, date, next.name, next.phone, token, next.member_id, next.payment);

      d.prepare("UPDATE waitlist SET promoted_at = datetime('now') WHERE id = ?").run(next.id);
      d.exec("COMMIT");

      const row = d
        .prepare(`SELECT ${BOOKING_COLUMNS} FROM ${BOOKING_FROM} WHERE b.id = ?`)
        .get(info.lastInsertRowid) as BookingDbRow;
      return toBooking(row);
    } catch (error) {
      d.exec("ROLLBACK");
      // Already booked despite being on the list - nothing to promote.
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  },

  async listPromoted(from, to): Promise<BookingRow[]> {
    const rows = open()
      .prepare(
        `SELECT ${BOOKING_COLUMNS} FROM ${BOOKING_FROM}
          WHERE b.class_date BETWEEN ? AND ?
            AND b.promoted_at IS NOT NULL
            AND b.cancelled_at IS NULL
          ORDER BY b.class_date, datetime(b.promoted_at)`,
      )
      .all(from, to) as BookingDbRow[];
    return rows.map(toBooking);
  },

  async setPaid(id, paid) {
    // A member has nothing to pay, so there is nothing to tick off.
    const info = open()
      .prepare(
        paid
          ? "UPDATE bookings SET paid_at = datetime('now') WHERE id = ? AND member_id IS NULL"
          : "UPDATE bookings SET paid_at = NULL WHERE id = ? AND member_id IS NULL",
      )
      .run(id);
    return Number(info.changes) > 0;
  },

  async markTold(id) {
    open().prepare("UPDATE bookings SET promoted_at = NULL WHERE id = ?").run(id);
  },

  /* ---------------------------------------------------------------- */
  /* Members                                                           */

  async findMember(reference) {
    const wanted = String(reference ?? "").trim();
    if (!wanted) return { found: false as const, reason: "unknown" as const };
    const d = open();

    const byNumber = d
      .prepare(
        `SELECT ${MEMBER_COLUMNS} FROM members
          WHERE ended_at IS NULL AND lower(trim(member_no)) = lower(trim(?))
          LIMIT 1`,
      )
      .get(wanted) as MemberDbRow | undefined;
    if (byNumber) return { found: true as const, member: toMember(byNumber) };

    // Two memberships on one phone is a Couples & Friends plan, not a
    // mistake, so ask for the number rather than picking one of them.
    const byPhone = d
      .prepare(
        `SELECT ${MEMBER_COLUMNS} FROM members WHERE ended_at IS NULL AND phone = ? LIMIT 2`,
      )
      .all(wanted) as MemberDbRow[];
    if (byPhone.length === 1) return { found: true as const, member: toMember(byPhone[0]) };
    if (byPhone.length > 1) return { found: false as const, reason: "ambiguous" as const };

    return { found: false as const, reason: "unknown" as const };
  },

  async listMembers(): Promise<Member[]> {
    const rows = open()
      .prepare(`SELECT ${MEMBER_COLUMNS} FROM members ORDER BY lower(name)`)
      .all() as MemberDbRow[];
    return rows.map(toMember);
  },

  async addMember({ memberNo, name, phone }) {
    const id = crypto.randomUUID();
    try {
      open()
        .prepare("INSERT INTO members (id, member_no, name, phone) VALUES (?, ?, ?, ?)")
        .run(id, tidy(memberNo), name.trim(), phone.trim());
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { ok: false as const, reason: "duplicate-number" as const };
      }
      throw error;
    }

    const row = open()
      .prepare(`SELECT ${MEMBER_COLUMNS} FROM members WHERE id = ?`)
      .get(id) as MemberDbRow;
    return { ok: true as const, member: toMember(row) };
  },

  async updateMember(id, { memberNo, name, phone }) {
    try {
      const info = open()
        .prepare("UPDATE members SET member_no = ?, name = ?, phone = ? WHERE id = ?")
        .run(tidy(memberNo), name.trim(), phone.trim(), id);
      if (Number(info.changes) === 0) {
        return { ok: false as const, reason: "not-found" as const };
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { ok: false as const, reason: "duplicate-number" as const };
      }
      throw error;
    }
    return { ok: true as const };
  },

  async setMemberEnded(id, ended) {
    const info = open()
      .prepare(
        ended
          ? "UPDATE members SET ended_at = datetime('now') WHERE id = ?"
          : "UPDATE members SET ended_at = NULL WHERE id = ?",
      )
      .run(id);
    return Number(info.changes) > 0;
  },

  async removeMember(id) {
    const d = open();
    // The bookings keep the name and phone that were written onto them; only
    // the link to the membership goes.
    d.prepare("UPDATE bookings SET member_id = NULL WHERE member_id = ?").run(id);
    d.prepare("UPDATE waitlist SET member_id = NULL WHERE member_id = ?").run(id);
    const info = d.prepare("DELETE FROM members WHERE id = ?").run(id);
    return Number(info.changes) > 0;
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
    const d = open();

    // BEGIN IMMEDIATE takes the write lock up front, so two people clicking
    // at the same moment cannot both read "one place left" and both take it.
    d.exec("BEGIN IMMEDIATE");
    try {
      const taken = liveCount(d, sessionId, date);
      if (taken >= capacity) {
        d.exec("ROLLBACK");
        return { ok: false, reason: "full" };
      }

      const token = newToken();
      d.prepare(
        `INSERT INTO bookings (session_id, class_date, name, phone, token, member_id, payment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(sessionId, date, name, phone, token, memberId, payment);

      d.exec("COMMIT");
      return { ok: true, spotsLeft: capacity - taken - 1, token };
    } catch (error) {
      d.exec("ROLLBACK");
      if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
      throw error;
    }
  },
};
