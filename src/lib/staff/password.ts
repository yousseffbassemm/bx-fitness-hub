import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * One shared staff password, stored as a scrypt hash so the environment
 * variable is not the password itself. Node only - scrypt does not exist on
 * the Edge runtime, which is why login runs in a Node route handler.
 *
 * Format: scrypt.<saltHex>.<hashHex>
 *
 * Dots, not dollars: .env files expand $NAME, so a $-separated hash arrives
 * truncated to "scrypt" and every password is rejected.
 */
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt.${salt.toString("hex")}.${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | undefined) {
  if (!stored) return false;

  const [scheme, saltHex, hashHex] = stored.split(".");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const actual = (await scryptAsync(
    password,
    Buffer.from(saltHex, "hex"),
    KEY_LENGTH,
  )) as Buffer;

  return timingSafeEqual(actual, expected);
}
