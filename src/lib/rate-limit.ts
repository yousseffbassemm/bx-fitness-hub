/**
 * A cap on how often one caller can hit a public endpoint.
 *
 * The three public POST routes were open: anything could take bookings,
 * join waitlists or file enquiries as fast as it could ask. The enquiry one
 * is the expensive one, because every call sends two emails through Resend -
 * so a script pointed at it costs money and buries the real enquiries staff
 * are meant to read.
 *
 * Deliberately generous. Members share an address on the gym's own Wi-Fi, so
 * a tight per-IP limit would lock out the people this is for. It is here to
 * stop a machine, not to ration a person.
 *
 * In memory, which means per server. That is exactly right for the single
 * server this runs on now, and not enough on its own across several
 * instances - on Vercel each one would keep its own count, so the effective
 * limit multiplies by the number of instances. Still far better than none,
 * and the place to put a shared counter later.
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

/** Stop the map growing forever on a long-running server. */
function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, hit] of buckets) {
    if (hit.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Who is asking.
 *
 * Behind the Cloudflare tunnel every request arrives from Cloudflare, so the
 * socket address is useless and the forwarded header is the real caller. It
 * can be spoofed by anyone talking to the server directly, which is why this
 * is a brake and not a security control.
 */
export function callerKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

/**
 * Returns true when the call should go ahead.
 *
 * Fails open. A counter is not worth turning a real booking away over, so
 * anything unexpected here lets the request through.
 */
export function allow(key: string, limit: number, windowMs: number) {
  try {
    const now = Date.now();
    prune(now);

    const hit = buckets.get(key);
    if (!hit || hit.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (hit.count >= limit) return false;
    hit.count += 1;
    return true;
  } catch {
    return true;
  }
}

/** The one place the numbers live, so they read together. */
export const LIMITS = {
  /** Enquiries send two emails each, so this is the tightest. */
  lead: { limit: 8, windowMs: 60 * 60 * 1000 },
  /** Shared gym Wi-Fi means many real people behind one address. */
  booking: { limit: 40, windowMs: 60 * 60 * 1000 },
} as const;

/** The 429 body, phrased for a person rather than a crawler. */
export const tooManyMessage =
  "That is a lot of requests in a short time. Please wait a few minutes, or call us.";
