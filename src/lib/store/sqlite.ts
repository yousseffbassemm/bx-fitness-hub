import { mkdirSync } from "node:fs";
import path from "node:path";
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
  StaffUser,
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
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    )
  `);

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
  created_at: string;
  last_login_at: string | null;
};

const toStaff = (r: StaffRow): StaffUser => ({
  username: r.username,
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

  async upsertStaffUser(username, passwordHash) {
    open()
      .prepare(
        `INSERT INTO staff_users (username, password_hash) VALUES (?, ?)
         ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`,
      )
      .run(username, passwordHash);
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
        `SELECT id, session_id, class_date, name, phone, created_at, cancelled_at
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
    }[];

    return rows.map((r) => ({
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
    const r = open()
      .prepare(
        `SELECT id, session_id, class_date, name, phone, created_at, cancelled_at
           FROM bookings WHERE id = ?`,
      )
      .get(id) as
      | {
          id: number;
          session_id: string;
          class_date: string;
          name: string;
          phone: string;
          created_at: string;
          cancelled_at: string | null;
        }
      | undefined;

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

      d.prepare(
        "INSERT INTO bookings (session_id, class_date, name, phone) VALUES (?, ?, ?, ?)",
      ).run(sessionId, date, name, phone);

      d.exec("COMMIT");
      return { ok: true, spotsLeft: capacity - taken - 1 };
    } catch (error) {
      d.exec("ROLLBACK");
      if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
      throw error;
    }
  },
};
