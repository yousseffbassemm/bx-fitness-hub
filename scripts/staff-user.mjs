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
 * read it. In a terminal it is typed twice with no echo. Without a terminal -
 * an editor's shell, an agent, CI - set STAFF_PASSWORD instead. Only the
 * scrypt hash is ever stored.
 *
 * Writes to whichever store the site is actually reading.
 *
 * It used to always write to SQLite and say so in a line nobody reads. Once
 * the site was switched to Supabase that made this command quietly useless:
 * "Created ... Sign in at /staff" printed happily, the account went into a
 * database the site no longer opens, and the person could not sign in.
 * `remove` was worse - an admin took a departing colleague's access away,
 * was told it had worked, and it had not.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline";

const scryptAsync = promisify(scrypt);
const USERNAME = /^[a-z0-9_-]{3,32}$/;

// The app reads .env.local; so must this, or it would decide which store to
// use from an environment that has none of the answers in it.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // No file, which is the normal case on a fresh clone.
}

const file =
  process.env.BOOKINGS_DB_PATH ?? path.join(process.cwd(), ".data", "bookings.db");

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sqliteDb() {
  mkdirSync(path.dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec(`
    CREATE TABLE IF NOT EXISTS staff_users (
      username      TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'staff',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      last_login_at TEXT
    )
  `);
  // A database made before roles existed.
  const cols = d.prepare("PRAGMA table_info(staff_users)").all();
  if (cols.length && !cols.some((c) => c.name === "role")) {
    d.exec("ALTER TABLE staff_users ADD COLUMN role TEXT NOT NULL DEFAULT 'staff'");
    d.exec("UPDATE staff_users SET role = 'admin'");
  }
  return d;
}

/** The same choice src/lib/store makes, so both end up in the same place. */
function openStore() {
  if (supabaseUrl && supabaseKey) {
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    };
    const call = async (path, init = {}) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers ?? {}) },
      });
      if (!res.ok) {
        throw new Error(`Supabase ${res.status}: ${await res.text()}`);
      }
      // A write asking for return=minimal answers 201 with an empty body,
      // not 204, and res.json() on nothing throws rather than returning null.
      const body = await res.text();
      return body ? JSON.parse(body) : null;
    };

    return {
      label: supabaseUrl,
      list: () =>
        call("staff_users?select=username,role,created_at,last_login_at&order=username"),
      find: async (n) =>
        (await call(`staff_users?username=eq.${encodeURIComponent(n)}&select=*`))[0] ?? null,
      all: () => call("staff_users?select=username,role"),
      upsert: (n, hash, role) =>
        call("staff_users?on_conflict=username", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify([{ username: n, password_hash: hash, role }]),
        }),
      setPassword: (n, hash) =>
        call(`staff_users?username=eq.${encodeURIComponent(n)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ password_hash: hash }),
        }),
      setRole: (n, role) =>
        call(`staff_users?username=eq.${encodeURIComponent(n)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ role }),
        }),
      remove: (n) =>
        call(`staff_users?username=eq.${encodeURIComponent(n)}`, { method: "DELETE" }),
    };
  }

  const d = sqliteDb();
  return {
    label: file,
    list: async () =>
      d
        .prepare(
          "SELECT username, role, created_at, last_login_at FROM staff_users ORDER BY username",
        )
        .all(),
    find: async (n) =>
      d.prepare("SELECT * FROM staff_users WHERE username = ?").get(n) ?? null,
    all: async () => d.prepare("SELECT username, role FROM staff_users").all(),
    upsert: async (n, hash, role) =>
      d
        .prepare(
          `INSERT INTO staff_users (username, password_hash, role) VALUES (?, ?, ?)
           ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash`,
        )
        .run(n, hash, role),
    setPassword: async (n, hash) =>
      d.prepare("UPDATE staff_users SET password_hash = ? WHERE username = ?").run(hash, n),
    setRole: async (n, role) =>
      d.prepare("UPDATE staff_users SET role = ? WHERE username = ?").run(role, n),
    remove: async (n) => d.prepare("DELETE FROM staff_users WHERE username = ?").run(n),
  };
}

/**
 * Read a line with the terminal echo turned off.
 *
 * Raw mode and a character loop, rather than readline with its private
 * _writeToOutput overridden - that is an internal, it is not guaranteed to
 * suppress anything, and when it misbehaves it does so by handing back the
 * wrong string rather than by failing, which is how an account came to be
 * "created" and then not exist.
 *
 * Falls back to a plain line read when stdin is not a terminal, so the script
 * can be driven by a pipe.
 */
/** Lines from a piped stdin, read once and handed out in order. */
let piped = null;

function secret(prompt) {
  const { stdin, stdout } = process;

  if (!stdin.isTTY) {
    // One reader for the whole run. A fresh readline per prompt reads the
    // first line and then waits forever on a stream that is already finished.
    piped ??= (async () => {
      const lines = [];
      const rl = createInterface({ input: stdin });
      for await (const line of rl) lines.push(line);
      return lines;
    })();
    // null, not "", so an empty stdin is distinguishable from an empty line.
    return piped.then((lines) => (lines.length ? lines.shift() : null));
  }

  return new Promise((resolve) => {
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          // ctrl-c
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (ch >= " ") value += ch;
      }
    };

    stdin.on("data", onData);
  });
}

async function hash(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  // Dots, not dollars: .env expands $NAME, and this format is shared with it.
  return `scrypt.${salt.toString("hex")}.${key.toString("hex")}`;
}

/**
 * Where the password comes from, in order of preference.
 *
 * A terminal is best - nothing is echoed and nothing is recorded. But this is
 * often run somewhere without one (an editor's shell, an agent, CI), where
 * the prompt has nothing to read from and would simply hang. So an
 * environment variable is accepted too, and if neither is available it says
 * so immediately rather than waiting forever.
 */
async function askPassword() {
  const fromEnv = process.env.STAFF_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < 8) {
      console.error("STAFF_PASSWORD is too short - at least 8 characters.");
      process.exit(1);
    }
    return fromEnv;
  }

  const first = await secret("New password (min 8 characters, not shown): ");

  if (first === null) {
    console.error(
      "\nNo terminal to ask for a password on, and nothing piped in.\n\n" +
        "Run it in a terminal window, where it prompts with the password\n" +
        "hidden and records nothing:\n\n" +
        "    node scripts/staff-user.mjs add <username>\n\n" +
        "Or, where there is no terminal, pass it through the environment:\n\n" +
        "    STAFF_PASSWORD='your password' node scripts/staff-user.mjs add <username>\n",
    );
    process.exit(1);
  }

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

/** One readable shape, whichever store the date came out of. */
const when = (value) => {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
};

const [command, username] = process.argv.slice(2);
const store = openStore();

if (command === "list") {
  const rows = await store.list();
  if (!rows.length) {
    console.log("\nNo staff accounts yet.  node scripts/staff-user.mjs add <username>\n");
  } else {
    console.log("");
    for (const r of rows) {
      console.log(
        `  ${r.username.padEnd(20)} ${(r.role ?? "staff").padEnd(6)} added ${when(r.created_at)}   last in: ${when(r.last_login_at) ?? "never"}`,
      );
    }
    console.log("");
  }
  process.exit(0);
}

if (!["add", "reset", "remove", "role"].includes(command) || !username) {
  console.error(
    "Usage:\n" +
      "  node scripts/staff-user.mjs list\n" +
      "  node scripts/staff-user.mjs add    <username> [admin|staff]\n" +
      "  node scripts/staff-user.mjs reset  <username>\n" +
      "  node scripts/staff-user.mjs role   <username> <admin|staff>\n" +
      "  node scripts/staff-user.mjs remove <username>",
  );
  process.exit(1);
}

const name = username.trim().toLowerCase();

if (!USERNAME.test(name)) {
  console.error("Usernames are 3-32 characters: a-z, 0-9, underscore, hyphen. No dots.");
  process.exit(1);
}

const existing = await store.find(name);

if (command === "role") {
  const wanted = process.argv[4];
  if (!["admin", "staff"].includes(wanted)) {
    console.error("Role must be admin or staff.");
    process.exit(1);
  }
  if (!existing) {
    console.error(`No account called "${name}".`);
    process.exit(1);
  }
  // Never leave nobody in charge.
  if (wanted === "staff") {
    const everyone = await store.all();
    const admins = everyone.filter((u) => u.role === "admin").length;
    if (existing.role === "admin" && admins <= 1) {
      console.error(`"${name}" is the only admin. Make someone else an admin first.`);
      process.exit(1);
    }
  }
  await store.setRole(name, wanted);
  console.log(`\n"${name}" is now ${wanted}.\n`);
  process.exit(0);
}

if (command === "remove") {
  if (!existing) {
    console.error(`No account called "${name}".`);
    process.exit(1);
  }
  await store.remove(name);
  // The pages and the API both confirm the account still exists on every
  // request now, so this takes effect at once rather than at expiry.
  console.log(`\nRemoved "${name}" from ${store.label}.\nThey are signed out the next thing they touch.\n`);
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
const stored = await hash(password);

// The first account is an admin: someone has to be able to manage the rest.
const everyone = await store.all();
const asked = process.argv[4];
const role =
  command === "add"
    ? asked === "admin" || everyone.length === 0
      ? "admin"
      : asked === "staff"
        ? "staff"
        : "staff"
    : null;

if (role) {
  await store.upsert(name, stored, role);
} else {
  await store.setPassword(name, stored);
}

// Read it back. Saying "created" without checking is how the last version
// reported success for an account that was not there.
const check = await store.find(name);

if (!check || check.password_hash !== stored) {
  console.error(`\nSomething went wrong - "${name}" was not saved. Nothing changed.\n`);
  process.exit(1);
}

const finalRole = check.role;

console.log(
  `\n${command === "add" ? `Created "${name}" (${finalRole})` : `Password reset for "${name}"`} in ${store.label}\n` +
    `Sign in at /staff with that username.\n`,
);
