import { NextResponse } from "next/server";
import { report } from "@/lib/report";
import { verifyPassword } from "@/lib/staff/password";
import {
  SESSION_SECONDS,
  STAFF_COOKIE,
  USERNAME_PATTERN,
  createSessionToken,
  staffAuthConfigured,
} from "@/lib/staff/session";
import { getStore } from "@/lib/store";

// scrypt is Node-only, so this cannot run on the Edge runtime.
export const runtime = "nodejs";

/**
 * Crude per-IP throttle. Enough to make guessing over the network
 * impractical; it resets when the server does, which is fine because the
 * window is short.
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(ip: string) {
  const now = Date.now();

  // Sweep expired entries. The watchdog keeps this process up for days, and
  // an address that tried once and never came back should not be remembered
  // for all of them.
  if (attempts.size > 1000) {
    for (const [key, seen] of attempts) {
      if (now - seen.first > WINDOW_MS) attempts.delete(key);
    }
  }

  const entry = attempts.get(ip);

  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  if (!staffAuthConfigured()) {
    return NextResponse.json(
      { error: "The staff area is not configured on this server." },
      { status: 503 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (tooManyAttempts(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let username: unknown;
  let password: unknown;
  try {
    ({ username, password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 },
    );
  }

  const name = username.trim().toLowerCase();

  const store = await getStore();

  /*
    Reaching the accounts is a separate failure from getting the password
    wrong, and it was being reported as the same thing: the store threw, the
    route answered 500 with no body, and the form fell back to "Could not
    sign you in." Someone with the right password would sit there retyping
    it while the database was simply unreachable.
  */
  let user;
  try {
    user = USERNAME_PATTERN.test(name) ? await store.findStaffUser(name) : null;
  } catch (error) {
    await report("POST /api/staff/login", error, `looking up ${name}`);
    return NextResponse.json(
      { error: "Cannot reach the staff records just now. Try again shortly." },
      { status: 503 },
    );
  }

  /*
    The password is verified even when there is no such user, against a hash
    that cannot match. Skipping it would return "wrong" measurably faster for
    an unknown username than for a known one, which is a way to discover who
    has an account. scrypt is slow on purpose; both paths should be equally
    slow.
  */
  const ok = await verifyPassword(
    password,
    user?.passwordHash ?? "scrypt.00.00",
  );

  if (!user || !ok) {
    // Deliberately vague: naming which half was wrong confirms guesses.
    return NextResponse.json(
      { error: "That username and password do not match." },
      { status: 401 },
    );
  }

  const token = await createSessionToken(user.username);
  if (!token) {
    return NextResponse.json({ error: "Session signing unavailable." }, { status: 503 });
  }

  attempts.delete(ip);

  // Bookkeeping. They have proved who they are, so a failure to write down
  // when must not be what stops them getting in.
  try {
    await store.touchStaffLogin(user.username);
  } catch (error) {
    await report("POST /api/staff/login", error, `stamping ${user.username}`);
  }

  const response = NextResponse.json({ ok: true, username: user.username });
  response.cookies.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return response;
}
