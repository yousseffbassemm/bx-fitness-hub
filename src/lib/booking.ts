import { schedule, type Session } from "./site";

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
 * A stable id for a recurring slot. Derived rather than stored, so the
 * timetable in site.ts stays the plain transcription of BX's schedule card.
 */
export function sessionId(dayIndex: number, s: Session) {
  const slug = s.discipline
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${dayIndex}-${s.time.replace(/[^0-9]/g, "")}-${slug}`;
}

export function findSession(id: string): { dayIndex: number; session: Session } | null {
  for (let d = 0; d < schedule.length; d++) {
    for (const s of schedule[d].sessions) {
      if (sessionId(d, s) === id) return { dayIndex: d, session: s };
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
