/**
 * Generates the two environment variables the staff area needs.
 *
 *   node scripts/staff-password.mjs "the password you want"
 */
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const password = process.argv[2];

if (!password || password.length < 8) {
  console.error("Usage: node scripts/staff-password.mjs <password>");
  console.error("The password must be at least 8 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await scryptAsync(password, salt, 64);

console.log("\nAdd these to .env.local (never commit them):\n");
console.log(`STAFF_PASSWORD_HASH=scrypt.${salt.toString("hex")}.${hash.toString("hex")}`);
console.log(`STAFF_SESSION_SECRET=${randomBytes(32).toString("hex")}`);
console.log(
  "\nKeep STAFF_SESSION_SECRET stable - changing it signs everyone out.\n",
);
