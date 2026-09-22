/**
 * Where backups go, resolved the same way everywhere.
 *
 * Three things take backups - a person running npm run backup, the watchdog,
 * and the login agent - and they do not share an environment. So the choice
 * lives in a file next to the code rather than in a shell profile that only
 * one of them would read.
 *
 * Order: an explicit BACKUP_DIR wins, then the saved choice, then a folder
 * beside the code.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const configFile = path.join(root, ".backup-dir");

export function backupDir() {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;

  if (existsSync(configFile)) {
    const saved = readFileSync(configFile, "utf8").trim();
    if (saved) return saved;
  }

  return path.join(root, ".backups");
}

export function saveBackupDir(dir) {
  writeFileSync(configFile, `${dir}\n`, "utf8");
  return configFile;
}

export function configPath() {
  return configFile;
}
