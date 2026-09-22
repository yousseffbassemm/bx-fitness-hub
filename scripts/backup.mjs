/**
 * Back up the database.
 *
 *   node scripts/backup.mjs           take one, rotate old ones
 *   node scripts/backup.mjs --quiet   same, for a scheduled run
 *   node scripts/backup.mjs --list    what backups exist
 *
 * Not `cp`. The database runs in WAL mode, which means recent writes live in
 * bookings.db-wal and not in bookings.db - on this machine the main file was
 * 4KB while the log holding everything was 671KB. Copying the one file gets
 * you a database with no tables in it, and you find that out on the day you
 * need it.
 *
 * VACUUM INTO asks SQLite itself for a consistent, compacted copy, with the
 * log folded in and without stopping the server. The copy is then opened and
 * counted against the original before it is kept, because a backup nobody has
 * read back is a guess.
 */
import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { statfsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { backupDir, configPath, saveBackupDir } from "./backup-dir.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source =
  process.env.BOOKINGS_DB_PATH ?? path.join(root, ".data", "bookings.db");
const dir = backupDir();

/** How many to keep. Beyond this the oldest are removed. */
const KEEP = Number(process.env.BACKUP_KEEP ?? 30);

const quiet = process.argv.includes("--quiet");
const say = (...a) => !quiet && console.log(...a);

function tablesAndCounts(db) {
  const out = {};
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all();
  for (const t of tables) {
    out[t.name] = db.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get().c;
  }
  return out;
}

function existing() {
  try {
    return readdirSync(dir)
      .filter((f) => f.startsWith("bx-") && f.endsWith(".db"))
      .sort()
      .reverse()
      .map((f) => ({ file: f, full: path.join(dir, f), size: statSync(path.join(dir, f)).size }));
  } catch {
    return [];
  }
}

// --- where do they go -----------------------------------------------------
const setDirAt = process.argv.indexOf("--set-dir");
if (setDirAt !== -1) {
  const wanted = process.argv[setDirAt + 1];
  if (!wanted) {
    console.error("Usage: node scripts/backup.mjs --set-dir <folder>");
    process.exit(1);
  }
  const resolved = path.resolve(wanted.replace(/^~/, process.env.HOME ?? "~"));
  mkdirSync(resolved, { recursive: true });
  saveBackupDir(resolved);
  console.log(`\nBackups will go to ${resolved}`);
  console.log(`  remembered in ${configPath()}\n`);
  process.exit(0);
}

if (process.argv.includes("--where")) {
  console.log(`\n${backupDir()}\n`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  const all = existing();
  if (!all.length) {
    console.log(`\nNo backups in ${dir}\n`);
  } else {
    console.log(`\n${all.length} backup(s) in ${dir}\n`);
    for (const b of all) {
      console.log(`  ${b.file}   ${(b.size / 1024).toFixed(0)}KB`);
    }
    console.log("");
  }
  process.exit(0);
}

// --- take one -------------------------------------------------------------
let db;
try {
  db = new DatabaseSync(source, { readOnly: true });
} catch (error) {
  console.error(`Could not open ${source}: ${error.message}`);
  process.exit(1);
}

const before = tablesAndCounts(db);
if (Object.keys(before).length === 0) {
  console.error("The database has no tables - refusing to back up nothing.");
  process.exit(1);
}

mkdirSync(dir, { recursive: true });

const now = new Date();
const stamp =
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` +
  `_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

// The pid is in here so two runs that overlap cannot write the same
// temporary file. The final name is minute-stamped, so two in one minute
// simply replace each other, which is the right outcome.
const partial = path.join(dir, `.partial-${stamp}-${process.pid}.db`);
const target = path.join(dir, `bx-${stamp}.db`);

rmSync(partial, { force: true });

try {
  // VACUUM INTO refuses to overwrite, which is why this writes to a name
  // nothing else uses and renames only once it has been checked.
  db.exec(`VACUUM INTO '${partial.replace(/'/g, "''")}'`);
} catch (error) {
  console.error(`Backup failed: ${error.message}`);
  rmSync(partial, { force: true });
  process.exit(1);
}

// --- read it back ---------------------------------------------------------
let after;
try {
  after = tablesAndCounts(new DatabaseSync(partial, { readOnly: true }));
} catch (error) {
  console.error(`The backup could not be opened: ${error.message}`);
  rmSync(partial, { force: true });
  process.exit(1);
}

const mismatch = Object.entries(before).filter(([t, n]) => after[t] !== n);
if (mismatch.length) {
  console.error("The backup does not match the database. Keeping nothing.");
  for (const [t, n] of mismatch) {
    console.error(`  ${t}: ${n} rows in the database, ${after[t] ?? "no table"} in the backup`);
  }
  rmSync(partial, { force: true });
  process.exit(1);
}

renameSync(partial, target);

const rows = Object.entries(after)
  .map(([t, n]) => `${t} ${n}`)
  .join(", ");
say(`\nBacked up to ${target}`);
say(`  ${(statSync(target).size / 1024).toFixed(0)}KB - ${rows}`);

/*
  Say plainly when the backup is on the same disk as the thing it is backing
  up. It still protects against a bad edit, a bad migration or a corrupted
  write - but not against the machine being lost, stolen or dying, which is
  what most people picture when they hear the word. Reporting "backed up" and
  leaving that unsaid is the kind of false confidence this script exists to
  avoid.
*/
try {
  const sameDisk =
    statfsSync(path.dirname(source)).fsid === statfsSync(dir).fsid;
  if (sameDisk) {
    say(
      "  NOTE: this is on the same disk as the database. Safe from a bad\n" +
        "        write, not from losing the Mac. `npm run backup -- --set-dir`\n" +
        "        can point it somewhere that leaves the machine.",
    );
  }
} catch {
  // Not being able to compare filesystems is not worth failing a backup over.
}

// --- rotate ---------------------------------------------------------------
const all = existing();
const stale = all.slice(KEEP);
for (const b of stale) rmSync(b.full, { force: true });
if (stale.length) say(`  removed ${stale.length} older backup(s), keeping ${KEEP}`);
say("");
