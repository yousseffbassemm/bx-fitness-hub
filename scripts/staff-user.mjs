/**
 * Staff accounts.
 *
 *   node scripts/staff-user.mjs list
 *   node scripts/staff-user.mjs add    <username>
 *   node scripts/staff-user.mjs reset  <username>
 *   node scripts/staff-user.mjs remove <username>
 *
 * The password is asked for, never passed as an argument: an argument ends up
 * in shell history and in the process list, where anyone on the machine can
 * read it. It is typed twice, with no echo, and only its scrypt hash is
 * stored.
 *
 * This writes to the SQLite store, which is the default. On Supabase, run the
 * staff_users section of supabase/schema.sql and insert the row there.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline";

const scryptAsync = promisify(scrypt);
const USERNAME = /^[a-z0-9_-]{3,32}$/;

const file =
  process.env.BOOKINGS_DB_PATH ?? path.join(process.cwd(), ".data", "bookings.db");

function db() {
  mkdirSync(path.dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec(`
    CREATE TABLE IF NOT EXISTS staff_users (
      username      TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    )
  `);
  return d;
}

/** Read a line with the terminal echo turned off. */
function secret(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      // Keep the prompt on screen but print nothing for the keystrokes.
      if (["\n", "\r", "\u0004"].includes(String(char))) process.stdout.write("\n");
    };
    process.stdin.on("data", onData);
    rl.question("", (value) => {
      process.stdin.off("data", onData);
      rl.close();
      resolve(value);
    });
    rl._writeToOutput = () => {};
  });
}

async function hash(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  // Dots, not dollars: .env expands $NAME, and this format is shared with it.
  return `scrypt.${salt.toString("hex")}.${key.toString("hex")}`;
}

async function askPassword() {
  const first = await secret("New password (min 8 characters, not shown): ");
  if (first.length < 8) {
    console.error("\nToo short - at least 8 characters.");
    process.exit(1);
  }
  const again = await secret("Again to confirm: ");
  if (first !== again) {
    console.error("\nThose do not match. Nothing was changed.");
    process.exit(1);
  }
  return first;
}

const [command, username] = process.argv.slice(2);
const d = db();

if (command === "list") {
  const rows = d.prepare("SELECT username, created_at, last_login_at FROM staff_users ORDER BY username").all();
  if (!rows.length) {
    console.log("\nNo staff accounts yet.  node scripts/staff-user.mjs add <username>\n");
  } else {
    console.log("");
    for (const r of rows) {
      console.log(`  ${r.username.padEnd(20)} added ${r.created_at}   last in: ${r.last_login_at ?? "never"}`);
    }
    console.log("");
  }
  process.exit(0);
}

if (!["add", "reset", "remove"].includes(command) || !username) {
  console.error("Usage: node scripts/staff-user.mjs list | add <username> | reset <username> | remove <username>");
  process.exit(1);
}

const name = username.trim().toLowerCase();

if (!USERNAME.test(name)) {
  console.error("Usernames are 3-32 characters: a-z, 0-9, underscore, hyphen. No dots.");
  process.exit(1);
}

const existing = d.prepare("SELECT username FROM staff_users WHERE username = ?").get(name);

if (command === "remove") {
  if (!existing) {
    console.error(`No account called "${name}".`);
    process.exit(1);
  }
  d.prepare("DELETE FROM staff_users WHERE username = ?").run(name);
  console.log(`\nRemoved "${name}". Any session they still hold stays valid until it expires.\n`);
  process.exit(0);
}

if (command === "add" && existing) {
  console.error(`"${name}" already exists. Use reset to change the password.`);
  process.exit(1);
}
if (command === "reset" && !existing) {
  console.error(`No account called "${name}". Use add to create it.`);
  process.exit(1);
}

const password = await askPassword();
d.prepare(
  `INSERT INTO staff_users (username, password_hash) VALUES (?, ?)
   ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`,
).run(name, await hash(password));

console.log(`\n${command === "add" ? "Created" : "Password reset for"} "${name}". Sign in at /staff.\n`);
