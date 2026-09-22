/**
 * Staff session tokens.
 *
 * Signed with Web Crypto rather than node:crypto so the exact same code runs
 * in middleware (Edge) and in route handlers (Node).
 *
 * The token carries the username and an expiry, both covered by the
 * signature. Nothing secret is in it and it cannot be edited without the key.
 * Deliberately no database lookup to verify one: the Edge gate in proxy.ts
 * runs before every staff request and has no database to reach.
 */
export const STAFF_COOKIE = "bx_staff";

/** One shift. Staff re-enter the password the next day. */
export const SESSION_SECONDS = 10 * 60 * 60;

function secret() {
  const value = process.env.STAFF_SESSION_SECRET;
  // Fail closed: without a secret there is no way to sign anything, and a
  // staff area that lets everyone in is worse than one that is switched off.
  if (!value || value.length < 32) return null;
  return value;
}

/**
 * Whether sessions can be signed at all. Whether anyone can actually get in
 * is a separate question, answered by the accounts in the store - see the
 * login route.
 */
export function staffAuthConfigured() {
  return Boolean(secret());
}

/** Usernames go in the token, which is dot-separated, so no dots in them. */
export const USERNAME_PATTERN = /^[a-z0-9_-]{3,32}$/;

async function sign(payload: string, key: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  return Buffer.from(sig).toString("base64url");
}

/** Constant-time compare, so a wrong signature leaks nothing by timing. */
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(username: string) {
  const key = secret();
  if (!key || !USERNAME_PATTERN.test(username)) return null;

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${username}.${expires}`;
  return `${payload}.${await sign(payload, key)}`;
}

/** The signed-in username, or null. Null means "treat as signed out". */
export async function readSessionToken(token: string | undefined) {
  const key = secret();
  if (!key || !token) return null;

  const [username, expires, signature] = token.split(".");
  if (!username || !expires || !signature) return null;

  if (!USERNAME_PATTERN.test(username)) return null;
  if (!/^\d+$/.test(expires)) return null;
  if (Number(expires) * 1000 < Date.now()) return null;

  const expected = await sign(`${username}.${expires}`, key);
  return equal(signature, expected) ? username : null;
}

export async function verifySessionToken(token: string | undefined) {
  return (await readSessionToken(token)) !== null;
}
