import { NextResponse } from "next/server";
import { STAFF_COOKIE } from "@/lib/staff/session";

export const runtime = "nodejs";

/**
 * End a session whose account no longer exists.
 *
 * The gate in proxy.ts runs on the Edge with no database, so it can only
 * check that a token is signed and unexpired - which a removed colleague's
 * cookie still is. It lets them through to /staff; the page then looks the
 * account up, finds nothing, and sends them to the login screen; proxy sees
 * the same valid signature and sends them straight back. That is an infinite
 * redirect, and it fires in exactly the situation the Team screen exists for:
 * somebody's access was revoked while they were signed in.
 *
 * Breaking it means getting rid of the cookie, which a page cannot do while
 * rendering. Hence a route handler: it clears the cookie, then sends them to
 * the login screen with nothing left to let them back in.
 */
export async function GET(request: Request) {
  const login = new URL("/staff/login", request.url);
  login.searchParams.set("ended", "1");

  const response = NextResponse.redirect(login);
  response.cookies.delete(STAFF_COOKIE);
  return response;
}
