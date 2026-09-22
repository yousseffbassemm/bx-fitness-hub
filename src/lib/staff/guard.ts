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

  return { ok: true as const, username };
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
  if (!auth.ok) return auth;

  const user = await (await getStore()).findStaffUser(auth.username);

  // The account was removed while its session was still valid.
  if (!user) {
    return { ok: false as const, status: 401, error: "That account is gone." };
  }

  if (user.role !== "admin") {
    return {
      ok: false as const,
      status: 403,
      error: "Only an admin can change accounts.",
    };
  }

  return { ok: true as const, username: auth.username };
}
