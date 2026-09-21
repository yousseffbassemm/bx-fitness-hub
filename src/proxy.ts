import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, verifySessionToken } from "@/lib/staff/session";

/**
 * Gate for the staff area.
 *
 * Runs before the route renders, so member names and phone numbers are never
 * produced - not even into a streamed RSC payload - for anyone without a
 * valid session. (Next 16 renamed this convention from middleware to proxy.)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const ok = await verifySessionToken(request.cookies.get(STAFF_COOKIE)?.value);

  // Already signed in and heading for the login screen: go to the list.
  if (pathname === "/staff/login") {
    if (ok) return NextResponse.redirect(new URL("/staff", request.url));
    return NextResponse.next();
  }

  if (ok) return NextResponse.next();

  const login = new URL("/staff/login", request.url);
  // Come back to whatever they were trying to reach.
  if (pathname !== "/staff") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/staff", "/staff/:path*"],
};
