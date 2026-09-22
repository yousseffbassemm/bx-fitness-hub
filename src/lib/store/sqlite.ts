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
  next.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS waitlist_live_unique
      ON waitlist (session_id, class_date, phone)
      WHERE promoted_at IS NULL
  `);
  next.exec("CREATE INDEX IF NOT EXISTS waitlist_date_idx ON waitlist (class_date)");

  next.exec("CREATE INDEX IF NOT EXISTS bookings_date_idx ON bookings (class_date)");
  next.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_live_unique
      ON bookings (session_id, class_date, phone)
      WHERE cancelled_at IS NULL
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
};

const BOOKING_COLUMNS =
  "id, session_id, class_date, name, phone, created_at, cancelled_at, token, promoted_at";

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
           FROM bookings
          WHERE class_date BETWEEN ? AND ?
          ORDER BY class_date ASC, created_at ASC`,
      )
      .all(from, to) as {
      id: number;
      session_id: string;
      class_date: string;
      name: string;
      phone: string;
      created_at: string;
      cancelled_at: string | null;
      token: string | null;
      promoted_at: string | null;
    }[];

    return rows.map(toBooking);
  },

  async get(id): Promise<BookingRow | null> {
    const r = open()
      .prepare(`SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = ?`)
      .get(id) as BookingDbRow | undefined;
    return r ? toBooking(r) : null;
  },

  async getByToken(token): Promise<BookingRow | null> {
    if (!token) return null;
    const r = open()
      .prepare(`SELECT ${BOOKING_COLUMNS} FROM bookings WHERE token = ?`)
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

  async joinWaitlist({ sessionId, date, name, phone }) {
    const d = open();
    try {
      d.prepare(
        "INSERT INTO waitlist (session_id, class_date, name, phone) VALUES (?, ?, ?, ?)",
      ).run(sessionId, date, name, phone);
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
        `SELECT id, session_id, class_date, name, phone, created_at, promoted_at
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
    }[];

    return rows.map((r) => ({
      id: String(r.id),
      sessionId: r.session_id,
      date: r.class_date,
      name: r.name,
      phone: r.phone,
      createdAt: r.created_at,
      promotedAt: r.promoted_at,
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
          `SELECT id, name, phone FROM waitlist
            WHERE session_id = ? AND class_date = ? AND promoted_at IS NULL
            ORDER BY datetime(created_at), id
            LIMIT 1`,
        )
        .get(sessionId, date) as { id: number; name: string; phone: string } | undefined;

      if (!next) {
        d.exec("ROLLBACK");
        return null;
      }

      const token = newToken();
      const info = d
        .prepare(
          `INSERT INTO bookings (session_id, class_date, name, phone, token, promoted_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        )
        .run(sessionId, date, next.name, next.phone, token);

      d.prepare("UPDATE waitlist SET promoted_at = datetime('now') WHERE id = ?").run(next.id);
      d.exec("COMMIT");

      const row = d
        .prepare(`SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = ?`)
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
        `SELECT ${BOOKING_COLUMNS} FROM bookings
          WHERE class_date BETWEEN ? AND ?
            AND promoted_at IS NOT NULL
            AND cancelled_at IS NULL
          ORDER BY class_date, datetime(promoted_at)`,
      )
      .all(from, to) as BookingDbRow[];
    return rows.map(toBooking);
  },

  async markTold(id) {
    open().prepare("UPDATE bookings SET promoted_at = NULL WHERE id = ?").run(id);
  },

  async book({ sessionId, date, name, phone, capacity }: BookingInput): Promise<BookingResult> {
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
        "INSERT INTO bookings (session_id, class_date, name, phone, token) VALUES (?, ?, ?, ?, ?)",
      ).run(sessionId, date, name, phone, token);

      d.exec("COMMIT");
      return { ok: true, spotsLeft: capacity - taken - 1, token };
    } catch (error) {
      d.exec("ROLLBACK");
      if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
      throw error;
    }
  },
};
