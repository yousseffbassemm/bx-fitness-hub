import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/staff/password";
import {
  SESSION_SECONDS,
  STAFF_COOKIE,
  createSessionToken,
  staffAuthConfigured,
} from "@/lib/staff/session";

// scrypt is Node-only, so this cannot run on the Edge runtime.
export const runtime = "nodejs";

/**
 * Crude per-IP throttle. Enough to make guessing a shared password over the
 * network impractical; it resets when the server does, which is fine because
 * the window is short.
 */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(ip: string) {
  const now = Date.now();
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

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Enter the staff password." }, { status: 400 });
  }

  if (!(await verifyPassword(password, process.env.STAFF_PASSWORD_HASH))) {
    // Deliberately vague: there is only one password, so naming what was
    // wrong would just confirm guesses.
    return NextResponse.json({ error: "That password is not right." }, { status: 401 });
  }

  const token = await createSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Session signing unavailable." }, { status: 503 });
  }

  attempts.delete(ip);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return response;
}
