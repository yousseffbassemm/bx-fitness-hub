import { STAFF_COOKIE, verifySessionToken } from "./session";

/**
 * Guard for staff API routes.
 *
 * src/proxy.ts covers the /staff pages, but not /api/staff/* - the login
 * route has to stay reachable - so state-changing endpoints check for
 * themselves.
 *
 * The Origin check is belt and braces on top of the sameSite=lax cookie:
 * lax already blocks cross-site POSTs, and this refuses anything that does
 * arrive claiming a different origin.
 */
export async function requireStaff(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STAFF_COOKIE}=`))
    ?.slice(STAFF_COOKIE.length + 1);

  if (!(await verifySessionToken(token))) {
    return { ok: false as const, status: 401, error: "Not signed in." };
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return { ok: false as const, status: 403, error: "Bad origin." };
    }
    if (!host || originHost !== host) {
      return { ok: false as const, status: 403, error: "Bad origin." };
    }
  }

  return { ok: true as const };
}
