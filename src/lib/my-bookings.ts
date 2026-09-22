/**
 * The bookings this browser has taken.
 *
 * A member has no account, so the token in their link is the only handle on
 * a booking. The dialog showed that link once, on the confirmation, and it
 * was never shown again - the timetable went on saying "Book" next to a
 * class they already had a place in, and clicking it answered "That number
 * is already booked onto this class" in red, which reads as a failure when
 * it is the opposite. The one way back to their own booking was a link they
 * had to have copied at exactly the right moment.
 *
 * So the token is kept here, against the slot it belongs to, and the
 * timetable reads it back.
 *
 * Per browser, and only ever a convenience: it is wiped by clearing site
 * data, absent in a private window, and unknown on their other phone. The
 * booking itself lives in the database and staff can always find it by
 * phone number. Every call is wrapped, because storage throws rather than
 * returning null in some modes, and a booking that worked must never look
 * like one that failed over a nicety.
 */

const KEY = "bx:bookings";

export type MyBookings = Record<string, string>;

export function readMine(): MyBookings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    // Anything that is not a slot pointing at a token is not ours to trust.
    const out: MyBookings = {};
    for (const [slot, token] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof token === "string" && /^[a-f0-9]{16,64}$/.test(token)) out[slot] = token;
    }
    return out;
  } catch {
    return {};
  }
}

export function remember(slot: string, token: string) {
  try {
    const mine = readMine();
    mine[slot] = token;
    localStorage.setItem(KEY, JSON.stringify(mine));
  } catch {
    // The link on the confirmation is still there; nothing is lost that was
    // not already only on screen.
  }
}

/** After a cancellation, so the timetable stops claiming the place. */
export function forgetToken(token: string) {
  try {
    const mine = readMine();
    let changed = false;
    for (const [slot, held] of Object.entries(mine)) {
      if (held === token) {
        delete mine[slot];
        changed = true;
      }
    }
    if (changed) localStorage.setItem(KEY, JSON.stringify(mine));
  } catch {
    // Worst case the row offers a link to a booking that is already
    // cancelled, and that page says so plainly.
  }
}
