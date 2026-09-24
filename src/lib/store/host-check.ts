/**
 * Whether this is a hosted deploy that has no database configured.
 *
 * Without Supabase the store falls back to SQLite, which on a serverless
 * host means one of two things and neither is survivable: the filesystem is
 * read only, so every booking fails with a message about the records being
 * out of reach; or it is writable but per-instance and wiped on the next
 * deploy, so bookings are taken, confirmed, and quietly gone. The second is
 * worse - nothing about it looks wrong until somebody turns up for a class
 * they are not on.
 *
 * Deliberately dependency-free: next.config.ts imports this to fail the
 * build, and it is loaded before anything else is set up.
 */
export function unconfiguredHostError(
  env: Record<string, string | undefined> = process.env,
  configured: boolean = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
): string | null {
  if (configured) return null;
  // Vercel sets VERCEL on its builds and its lambdas; the other is for any
  // host that does not, so this is not tied to one provider. A local build
  // and CI set neither and carry on with SQLite, which is the point of it.
  if (!env.VERCEL && !env.BX_REQUIRE_SUPABASE) return null;

  return (
    "This is a hosted deploy with no database configured. Set SUPABASE_URL " +
    "and SUPABASE_SERVICE_ROLE_KEY in the hosting provider's environment " +
    "variables. Without them bookings would either fail outright or be " +
    "written to a filesystem that is wiped on the next deploy."
  );
}
