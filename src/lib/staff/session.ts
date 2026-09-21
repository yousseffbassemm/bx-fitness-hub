/**
 * Staff session tokens.
 *
 * Signed with Web Crypto rather than node:crypto so the exact same code runs
 * in middleware (Edge) and in route handlers (Node). The token carries only
 * an expiry - there is nothing in it worth stealing, and it cannot be edited
 * without the secret.
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

export function staffAuthConfigured() {
  return Boolean(secret() && process.env.STAFF_PASSWORD_HASH);
}

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

export async function createSessionToken() {
  const key = secret();
  if (!key) return null;

  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${expires}.${await sign(String(expires), key)}`;
}

export async function verifySessionToken(token: string | undefined) {
  const key = secret();
  if (!key || !token) return false;

  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;

  if (!/^\d+$/.test(expires)) return false;
  if (Number(expires) * 1000 < Date.now()) return false;

  return equal(signature, await sign(expires, key));
}
