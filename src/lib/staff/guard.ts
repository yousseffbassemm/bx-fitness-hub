import { getStore } from "../store";
import { STAFF_COOKIE, readSessionToken } from "./session";

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
function cookieToken(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STAFF_COOKIE}=`))
    ?.slice(STAFF_COOKIE.length + 1);
}

export async function requireStaff(request: Request) {
  const username = await readSessionToken(cookieToken(request));

  if (!username) {
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

  /*
    The signature proves the token is ours and has not expired. It cannot
    prove the account still exists, because the Edge gate that issued the
    request has no database - this is the first place that can ask.

    Without this, removing a colleague only took the pages away from them.
    Their token stayed good against these endpoints for the rest of its ten
    hours, which is long enough to cancel members' places on the way out.
  */
  const user = await (await getStore()).findStaffUser(username);
  if (!user) {
    return { ok: false as const, status: 401, error: "That account is gone." };
  }

  return { ok: true as const, username, user };
}

/**
 * Guard for anything only an admin may do.
 *
 * The role is read from the store on every call rather than carried in the
 * session token. A token lasts a shift, so a role baked into one would mean a
 * colleague who has just been demoted keeps their old powers for hours - and
 * the moment access is revoked is exactly the moment that matters.
 */
export async function requireAdmin(request: Request) {
  const auth = await requireStaff(request);
  // requireStaff has already established the account is still there.
  if (!auth.ok) return auth;

  const user = auth.user;

  if (user.role !== "admin") {
    return {
      ok: false as const,
      status: 403,
      // This guard covers prices, photographs and the problem list as well
      // as accounts, so it does not name one of them.
      error: "Only an admin can do that.",
    };
  }

  return { ok: true as const, username: auth.username };
}
