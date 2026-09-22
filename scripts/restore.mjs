/**
 * Put a backup back.
 *
 *   node scripts/restore.mjs --list
 *   node scripts/restore.mjs latest
 *   node scripts/restore.mjs bx-2026-09-22_1518.db
 *
 * The database being replaced is moved aside first, never deleted, so a
 * restore of the wrong file is itself undoable. Stop the server before
 * running this: swapping the file under a live connection leaves the process
 * holding a database that no longer exists.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { backupDir } from "./backup-dir.mjs";
import { execSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const live = process.env.BOOKINGS_DB_PATH ?? path.join(root, ".data", "bookings.db");
const dir = backupDir();

function counts(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  const out = {};
  for (const t of db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()) {
    out[t.name] = db.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get().c;
  }
  return out;
}

function backups() {
  try {
    return readdirSync(dir)
      .filter((f) => f.startsWith("bx-") && f.endsWith(".db"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

const which = process.argv[2];
const all = backups();

if (!which || which === "--list") {
  if (!all.length) {
    console.log(`\nNo backups in ${dir}\n`);
    process.exit(1);
  }
  console.log(`\nBackups in ${dir}\n`);
  for (const f of all) {
    let summary = "";
    try {
      summary =
        "  " +
        Object.entries(counts(path.join(dir, f)))
          .map(([t, n]) => `${t} ${n}`)
          .join(", ");
    } catch {
      summary = "  (unreadable)";
    }
    console.log(`  ${f}${summary}`);
  }
  console.log(`\nRestore one with:  node scripts/restore.mjs ${all[0]}\n`);
  process.exit(0);
}

const chosen = which === "latest" ? all[0] : which;
if (!chosen) {
  console.error("No backups to restore.");
  process.exit(1);
}

const file = path.isAbsolute(chosen) ? chosen : path.join(dir, chosen);
if (!existsSync(file)) {
  console.error(`No such backup: ${file}`);
  process.exit(1);
}

// Refuse to restore something unreadable.
let incoming;
try {
  incoming = counts(file);
} catch (error) {
  console.error(`That backup cannot be opened: ${error.message}`);
  process.exit(1);
}
if (Object.keys(incoming).length === 0) {
  console.error("That backup has no tables in it. Refusing.");
  process.exit(1);
}

// Warn loudly if something still has the database open.
try {
  const holding = execSync(`lsof -t "${live}" 2>/dev/null || true`, { encoding: "utf8" }).trim();
  if (holding) {
    console.error(
      `\nSomething still has the database open (pid ${holding.split("\n").join(", ")}).\n` +
        `Stop the server first:  npm run dev:stop\n`,
    );
    process.exit(1);
  }
} catch {
  // lsof missing is not a reason to refuse.
}

mkdirSync(path.dirname(live), { recursive: true });

// Move the current database aside rather than overwrite it.
if (existsSync(live)) {
  const aside = `${live}.replaced-${Date.now()}`;
  renameSync(live, aside);
  // WAL and shm belong to the file being replaced; leaving them would apply
  // the old log on top of the restored data.
  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(live + suffix)) renameSync(live + suffix, aside + suffix);
  }
  console.log(`\nCurrent database moved to ${path.basename(aside)}`);
}

copyFileSync(file, live);

const restored = counts(live);
console.log(`Restored ${path.basename(file)}`);
console.log(
  "  " +
    Object.entries(restored)
      .map(([t, n]) => `${t} ${n}`)
      .join(", "),
);
console.log(`\nStart the server again:  npm run dev:watch\n`);
