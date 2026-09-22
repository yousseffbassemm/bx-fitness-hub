import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE, readSessionToken } from "./session";
import { getStore } from "../store";

/**
 * Admin-only pages.
 *
 * The layout has already established there is a session; this is the second
 * question - whether this person may be here. A non-admin is sent to the work
 * they can actually do rather than shown a page of controls the server will
 * refuse, and the API guards still check for themselves regardless.
 */
export async function requireAdminPage() {
  const me = await readSessionToken((await cookies()).get(STAFF_COOKIE)?.value);
  if (!me) redirect("/staff/login");

  const user = await (await getStore()).findStaffUser(me);
  // Account gone: clear the cookie rather than bouncing into the same loop.
  if (!user) redirect("/api/staff/session-ended");
  if (user.role !== "admin") redirect("/staff");

  return user;
}
