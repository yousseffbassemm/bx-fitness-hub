import type { Session } from "./site";

/** The shape both the code timetable and a saved one satisfy. */
type ScheduleLike = { sessions: (Session & { id?: string })[] }[];

/**
 * PLACEHOLDER - BX has not told us how many places each class holds.
 * One number to change, or give a discipline its own entry below.
 */
export const DEFAULT_CLASS_CAPACITY = 14;

const CAPACITY_BY_DISCIPLINE: Record<string, number> = {
  // e.g. "Indoor Cycling": 18,  // limited by the number of bikes
};

export function capacityFor(discipline: string) {
  return CAPACITY_BY_DISCIPLINE[discipline] ?? DEFAULT_CLASS_CAPACITY;
}

/** How far ahead people can book. */
export const BOOKING_WINDOW_DAYS = 14;

/**
 * The timetable is listed Saturday-first, the way BX prints it.
 * These are the matching JS getDay() values.
 */
const WEEKDAY_OF_ROW = [6, 0, 1, 2, 3, 4, 5];

/**
 * The id a slot in site.ts gets when the timetable is seeded.
 *
 * Only used for seeding now. A saved timetable carries its own ids, fixed
 * when a class is created and untouched by later edits - because this
 * derivation changes the moment a class moves, and a booking that stored the
 * old value would point at nothing.
 */
export function sessionId(dayIndex: number, s: Session) {
  const slug = s.discipline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${dayIndex}-${s.time.replace(/[^0-9]/g, "")}-${slug}`;
}

/**
 * Find a slot by id in a given timetable.
 *
 * Takes the timetable rather than reaching for the one in site.ts, because
 * the timetable is editable now and lives in the store - and this file is
 * imported by client code that has no database.
 */
export function findSessionIn(
  schedule: ScheduleLike,
  id: string,
): { dayIndex: number; session: Session } | null {
  for (let d = 0; d < schedule.length; d++) {
    for (const s of schedule[d].sessions) {
      // A saved session has its own id; one seeded from the code falls back
      // to the derivation, which produced the ids older bookings stored.
      if ((s.id ?? sessionId(d, s)) === id) return { dayIndex: d, session: s };
    }
  }
  return null;
}

/** YYYY-MM-DD in local time. Never use toISOString here - it shifts the day. */
export function toISODate(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * The next date this row of the timetable falls on, today included.
 *
 * Computed in the visitor's own timezone on the client and then sent to the
 * server, so a server running outside Cairo cannot book someone onto the
 * wrong day.
 */
export function nextDateForRow(dayIndex: number, from = new Date()) {
  const target = WEEKDAY_OF_ROW[dayIndex];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const delta = (target - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/** Guards a client-supplied date against the slot it claims to be for. */
/**
 * Minutes past midnight for a time written the way the timetable writes it:
 * "2:00 PM", "8:30 PM". Null when it cannot be read, which is treated as
 * "unknown", never as "past" - a class must not become unbookable because
 * somebody typed its time oddly on the Timetable screen.
 */
export function minutesOfDay(time: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?\s*$/.exec(time);
  if (!m) return null;
  const hour12 = Number(m[1]);
  const minute = Number(m[2]);
  if (hour12 < 1 || hour12 > 12 || minute > 59) return null;
  const hour = (hour12 % 12) + (m[3].toLowerCase() === "p" ? 12 : 0);
  return hour * 60 + minute;
}

/**
 * Whether a class on this date has already begun.
 *
 * Booking only ever checked the date, so a class stayed bookable until
 * midnight: at 11:30 PM the timetable still offered the 9 PM class that
 * finished two hours earlier, took the booking, and said "You're in". For a
 * gym whose last class ends well before it closes, that is a few hours
 * every night of advertising classes that are over.
 */
export function hasStarted(time: string, iso: string, now = new Date()) {
  const minutes = minutesOfDay(time);
  if (minutes === null) return false;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return false;
  const start = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
  return start.getTime() <= now.getTime();
}

export function isDateValidForRow(dayIndex: number, iso: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;

  const [y, m, day] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  if (Number.isNaN(date.getTime())) return false;
  if (date.getMonth() !== m - 1 || date.getDate() !== day) return false;

  if (date.getDay() !== WEEKDAY_OF_ROW[dayIndex]) return false;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  return days >= 0 && days <= BOOKING_WINDOW_DAYS;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export type Availability = Record<string, number>;

/** Key used by the availability map and the store. */
export function slotKey(id: string, date: string) {
  return `${id}|${date}`;
}
