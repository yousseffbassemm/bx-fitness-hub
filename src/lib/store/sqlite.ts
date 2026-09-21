import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { slotKey } from "../booking";
import type { BookingInput, BookingResult, BookingStore } from "./types";

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

function open() {
  if (db) return db;

  mkdirSync(path.dirname(file), { recursive: true });
  const next = new DatabaseSync(file);

  // WAL lets reads carry on while a booking is being written.
  next.exec("PRAGMA journal_mode = WAL");
  // Wait rather than fail if another request holds the write lock.
  next.exec("PRAGMA busy_timeout = 5000");
  next.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      class_date TEXT NOT NULL,
      name       TEXT NOT NULL,
      phone      TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (session_id, class_date, phone)
    )
  `);
  next.exec("CREATE INDEX IF NOT EXISTS bookings_date_idx ON bookings (class_date)");

  db = next;
  return db;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

export const sqliteStore: BookingStore = {
  name: "sqlite",

  async counts(from, to) {
    const rows = open()
      .prepare(
        `SELECT session_id, class_date, COUNT(*) AS n
           FROM bookings
          WHERE class_date BETWEEN ? AND ?
          GROUP BY session_id, class_date`,
      )
      .all(from, to) as { session_id: string; class_date: string; n: number }[];

    const out: Record<string, number> = {};
    for (const r of rows) out[slotKey(r.session_id, r.class_date)] = Number(r.n);
    return out;
  },

  async book({ sessionId, date, name, phone, capacity }: BookingInput): Promise<BookingResult> {
    const d = open();

    // BEGIN IMMEDIATE takes the write lock up front, so two people clicking
    // at the same moment cannot both read "one place left" and both take it.
    d.exec("BEGIN IMMEDIATE");
    try {
      const { n } = d
        .prepare(
          "SELECT COUNT(*) AS n FROM bookings WHERE session_id = ? AND class_date = ?",
        )
        .get(sessionId, date) as { n: number };

      const taken = Number(n);
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
