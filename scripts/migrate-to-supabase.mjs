#!/usr/bin/env node
/**
 * Move everything in the local SQLite database into Supabase.
 *
 * Run this ONCE, before switching the app over. Setting SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY makes the app use Supabase from the next
 * restart, and if the tables are still empty at that moment the site comes
 * up with no bookings, no enquiries and nobody able to sign in. The data
 * has to be there first.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-to-supabase.mjs
 *
 * Safe to stop and think about: it refuses to run against tables that
 * already hold rows unless you pass --force, and it reads the counts back
 * from Supabase at the end rather than trusting that the writes landed.
 *
 * The local database is only ever read. Nothing here deletes anything.
 */

import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const force = process.argv.includes("--force");
const dbPath =
  process.env.BOOKINGS_DB_PATH ?? path.join(process.cwd(), ".data", "bookings.db");

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

/**
 * SQLite writes datetime('now') in UTC with a space and no zone marker.
 * Postgres reads a bare timestamp in the server's own zone, so handing it
 * over untouched would move every record by the offset - three hours, here.
 */
const stamp = (v) =>
  v == null ? null : /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(v)
    ? `${v.replace(" ", "T")}Z`
    : v;

async function countRemote(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  if (!res.ok) throw new Error(`count ${table}: ${res.status} ${await res.text()}`);
  return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
}

async function push(table, rows, { upsert = false } = {}) {
  if (rows.length === 0) return 0;

  // In batches, so one oversized body cannot fail the whole table.
  let sent = 0;
  const size = table === "uploads" ? 1 : 200;

  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: upsert ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      throw new Error(`insert ${table}: ${res.status} ${await res.text()}`);
    }
    sent += batch.length;
  }
  return sent;
}

const db = new DatabaseSync(dbPath, { readOnly: true });
const all = (sql) => db.prepare(sql).all();

const local = {
  bookings: all("SELECT * FROM bookings").map((r) => ({
    // id is left out on purpose: it is an integer here and a uuid there.
    session_id: r.session_id,
    class_date: r.class_date,
    name: r.name,
    phone: r.phone,
    created_at: stamp(r.created_at),
    cancelled_at: stamp(r.cancelled_at),
    // Carried over, because it is the link a member already holds.
    token: r.token ?? null,
    promoted_at: stamp(r.promoted_at),
  })),
  leads: all("SELECT * FROM leads").map((r) => ({
    name: r.name,
    phone: r.phone,
    email: r.email,
    goal: r.goal,
    created_at: stamp(r.created_at),
    handled_at: stamp(r.handled_at),
  })),
  staff_users: all("SELECT * FROM staff_users").map((r) => ({
    username: r.username,
    // The hash, not the password. Without it nobody can sign in again.
    password_hash: r.password_hash,
    role: r.role ?? "staff",
    created_at: stamp(r.created_at),
    last_login_at: stamp(r.last_login_at),
  })),
  site_content: all("SELECT * FROM site_content").map((r) => ({
    key: r.key,
    // TEXT here, jsonb there.
    value: JSON.parse(r.value),
    edited_by: r.edited_by,
    edited_at: stamp(r.edited_at),
  })),
  uploads: all("SELECT * FROM uploads").map((r) => ({
    // The id is a hash of the bytes and is referenced by saved content, so
    // it has to survive the move exactly.
    id: r.id,
    mime: r.mime,
    bytes_b64: Buffer.from(r.bytes).toString("base64"),
    created_at: stamp(r.created_at),
  })),
  waitlist: all("SELECT * FROM waitlist").map((r) => ({
    session_id: r.session_id,
    class_date: r.class_date,
    name: r.name,
    phone: r.phone,
    created_at: stamp(r.created_at),
    promoted_at: stamp(r.promoted_at),
  })),
  errors: all("SELECT * FROM errors").map((r) => ({
    fingerprint: r.fingerprint,
    where_at: r.where_at,
    message: r.message,
    detail: r.detail,
    count: r.count,
    last_at: stamp(r.last_at),
  })),
};

// Natural primary keys, so re-running one of these replaces rather than doubles.
const upserts = new Set(["staff_users", "site_content", "uploads", "errors"]);

console.log(`\nFrom ${dbPath}`);
console.log(`To   ${url}\n`);

const occupied = [];
for (const table of Object.keys(local)) {
  const before = await countRemote(table);
  if (before > 0 && !upserts.has(table)) occupied.push(`${table} (${before})`);
}

if (occupied.length && !force) {
  console.error("These already hold rows, so inserting would duplicate them:");
  for (const t of occupied) console.error(`  ${t}`);
  console.error("\nEmpty them first, or re-run with --force if you mean it.");
  process.exit(1);
}

let failed = false;
for (const [table, rows] of Object.entries(local)) {
  process.stdout.write(`  ${table.padEnd(13)} ${String(rows.length).padStart(4)} rows  `);
  try {
    await push(table, rows, { upsert: upserts.has(table) });
    const after = await countRemote(table);
    const ok = after >= rows.length;
    if (!ok) failed = true;
    console.log(`${ok ? "->" : "!!"} ${after} in Supabase`);
  } catch (error) {
    failed = true;
    console.log("FAILED");
    console.error(`     ${error.message}`);
  }
}

console.log(
  failed
    ? "\nSomething did not land. Fix it before switching the app over.\n"
    : "\nEverything is across. Read the counts above against the local ones.\n",
);
process.exit(failed ? 1 : 0);
