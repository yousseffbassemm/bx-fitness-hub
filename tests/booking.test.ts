import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_WINDOW_DAYS,
  capacityFor,
  DEFAULT_CLASS_CAPACITY,
  findSessionIn,
  formatDate,
  hasStarted,
  isDateValidForRow,
  minutesOfDay,
  nextDateForRow,
  sessionId,
  slotKey,
  toISODate,
} from "../src/lib/booking.ts";
import { schedule } from "../src/lib/site.ts";

/*
  Dates used throughout, so the weekday is never in doubt:

    2026-09-23  Wednesday   row 4
    2026-09-26  Saturday    row 0
    2026-09-27  Sunday      row 1
*/
const WED = "2026-09-23";
const SAT = "2026-09-26";
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("minutesOfDay", () => {
  it("reads the format the timetable is written in", () => {
    assert.equal(minutesOfDay("2:00 PM"), 14 * 60);
    assert.equal(minutesOfDay("8:30 PM"), 20 * 60 + 30);
    assert.equal(minutesOfDay("9:00 AM"), 9 * 60);
  });

  it("gets midnight and noon the right way round", () => {
    // The two everybody gets wrong: 12 AM is 0, 12 PM is midday.
    assert.equal(minutesOfDay("12:00 AM"), 0);
    assert.equal(minutesOfDay("12:30 AM"), 30);
    assert.equal(minutesOfDay("12:00 PM"), 12 * 60);
    assert.equal(minutesOfDay("12:30 PM"), 12 * 60 + 30);
  });

  it("tolerates the ways people type it", () => {
    assert.equal(minutesOfDay("  7:00 pm  "), 19 * 60);
    assert.equal(minutesOfDay("7:00 p.m."), 19 * 60);
  });

  it("returns null rather than guessing", () => {
    for (const bad of ["", "nonsense", "25:00 PM", "7:70 PM", "0:30 PM", "19:00", "7 PM"]) {
      assert.equal(minutesOfDay(bad), null, `should not read ${JSON.stringify(bad)}`);
    }
  });
});

describe("hasStarted", () => {
  it("is false before the class and true from the minute it begins", () => {
    assert.equal(hasStarted("9:00 PM", WED, at(2026, 9, 23, 20, 59)), false);
    assert.equal(hasStarted("9:00 PM", WED, at(2026, 9, 23, 21, 0)), true);
    assert.equal(hasStarted("9:00 PM", WED, at(2026, 9, 23, 23, 30)), true);
  });

  it("is the bug it was written for: late at night, the day's classes are over", () => {
    // Booking used to compare dates only, so at 11:30 PM the timetable still
    // offered the 9 PM class that finished two and a half hours earlier.
    const lateOnTheNight = at(2026, 9, 23, 23, 30);
    for (const time of ["7:00 PM", "8:00 PM", "9:00 PM"]) {
      assert.equal(hasStarted(time, WED, lateOnTheNight), true, `${time} should be over`);
    }
  });

  it("never counts a later day as started", () => {
    assert.equal(hasStarted("7:00 PM", SAT, at(2026, 9, 23, 23, 59)), false);
  });

  it("treats a time it cannot read as unknown, never as past", () => {
    // A class must not become unbookable because somebody typed its time
    // oddly on the Timetable screen.
    assert.equal(hasStarted("whenever", WED, at(2026, 9, 23, 23, 59)), false);
    assert.equal(hasStarted("", WED, at(2026, 9, 23, 23, 59)), false);
  });
});

describe("isDateValidForRow", () => {
  const now = at(2026, 9, 23);

  it("takes today and the whole window ahead", () => {
    assert.equal(isDateValidForRow(4, WED, now), true, "today");
    assert.equal(isDateValidForRow(0, SAT, now), true, "this Saturday");
    // 14 days out lands on a Wednesday again, and is the last day taken.
    assert.equal(isDateValidForRow(4, "2026-10-07", now), true, `${BOOKING_WINDOW_DAYS} days`);
    assert.equal(isDateValidForRow(4, "2026-10-14", now), false, "beyond the window");
  });

  it("refuses the past", () => {
    assert.equal(isDateValidForRow(4, "2026-09-16", now), false);
    assert.equal(isDateValidForRow(0, "2026-09-19", now), false);
  });

  it("refuses a date that is not that class's weekday", () => {
    // Saturday's row, handed a Wednesday.
    assert.equal(isDateValidForRow(0, WED, now), false);
  });

  it("refuses anything that is not a real date", () => {
    for (const bad of ["", "tomorrow", "2026-02-31", "2026-13-01", "26-09-23", "2026-9-3"]) {
      assert.equal(isDateValidForRow(4, bad, now), false, `should refuse ${JSON.stringify(bad)}`);
    }
  });
});

describe("nextDateForRow", () => {
  it("gives today when today is that weekday", () => {
    assert.equal(toISODate(nextDateForRow(4, at(2026, 9, 23))), WED);
  });

  it("gives the next one otherwise", () => {
    assert.equal(toISODate(nextDateForRow(0, at(2026, 9, 23))), SAT);
    assert.equal(toISODate(nextDateForRow(3, at(2026, 9, 23))), "2026-09-29");
  });

  it("stays in local time, so nobody is moved a day by a timezone", () => {
    // Built from local parts, not from an ISO string the browser would read
    // as UTC and shift.
    const d = nextDateForRow(4, at(2026, 9, 23, 0, 30));
    assert.equal(toISODate(d), WED);
  });
});

describe("ids and keys", () => {
  it("derives the id a seeded class gets", () => {
    assert.equal(
      sessionId(0, { time: "2:00 PM", coach: "Nourhan Kamal", discipline: "Mobility & Flexibility" }),
      "0-200-mobility-flexibility",
    );
  });

  it("keeps a slot key readable and unique per class and date", () => {
    assert.equal(slotKey("0-200-mobility-flexibility", SAT), `0-200-mobility-flexibility|${SAT}`);
    assert.notEqual(slotKey("a", SAT), slotKey("a", WED));
  });

  it("finds a class in the timetable by the id bookings store", () => {
    const seeded = schedule.map((d, i) => ({
      ...d,
      sessions: d.sessions.map((s) => ({ ...s, id: sessionId(i, s) })),
    }));
    const found = findSessionIn(seeded, "0-200-mobility-flexibility");
    assert.ok(found, "should find it");
    assert.equal(found.dayIndex, 0);
    assert.equal(found.session.discipline, "Mobility & Flexibility");
    assert.equal(findSessionIn(seeded, "nope"), null);
  });
});

describe("capacity", () => {
  it("is the same for every class until one says otherwise", () => {
    assert.equal(capacityFor("Boxing"), DEFAULT_CLASS_CAPACITY);
    assert.equal(capacityFor("Anything At All"), DEFAULT_CLASS_CAPACITY);
  });
});

describe("formatDate", () => {
  it("writes a date the way the gym would say it", () => {
    assert.match(formatDate(SAT), /Saturday/);
    assert.match(formatDate(SAT), /26/);
    assert.match(formatDate(SAT), /September/);
  });
});
