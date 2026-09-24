import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import "./support/dom.ts";

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import Classes from "../src/components/sections/Classes.tsx";
import { slotKey, toISODate, nextDateForRow } from "../src/lib/booking.ts";

/*
  The timetable, after the fetch has settled.

  Everything interesting about this component happens once availability has
  come back: the places left, whether a class is bookable, and whether it has
  already run. None of it is in the first render, which is why none of it was
  reachable before there was a DOM to test in.
*/

const WEEKDAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const todayRow = [6, 0, 1, 2, 3, 4, 5].indexOf(new Date().getDay());

/** Today's row carries one class long over and one still to come. */
const schedule = WEEKDAYS.map((day, i) => ({
  day,
  short: day.slice(0, 3),
  sessions:
    i === todayRow
      ? [
          { id: "already-run", time: "12:00 AM", coach: "Nobody", discipline: "Long Over" },
          { id: "still-to-come", time: "11:59 PM", coach: "Nobody", discipline: "Later Tonight" },
        ]
      : [{ id: `class-${i}`, time: "7:00 PM", coach: "Coach", discipline: `${day} Class` }],
}));

const realFetch = globalThis.fetch;

/** Availability, with whatever is taken for each slot. */
function availability(taken: Record<string, number> = {}) {
  const capacity = Object.fromEntries(
    schedule.flatMap((d) => d.sessions.map((s) => [s.id, 14])),
  );
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ capacity, taken }), { status: 200 })) as typeof fetch;
}

const dateFor = (row: number) => toISODate(nextDateForRow(row));

/**
 * The timetable opens on Saturday, whatever day it is.
 *
 * Anything about a class having already run has to be on today's row to
 * mean anything - every other row's next date is in the future, where
 * nothing has started yet.
 */
async function showToday(user: ReturnType<typeof userEvent.setup>) {
  const tab = await screen.findByRole("tab", { name: new RegExp(WEEKDAYS[todayRow], "i") });
  await user.click(tab);
}

beforeEach(() => {
  availability();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  localStorage.clear();
});

describe("the timetable", () => {
  it("shows how many places are left once it has asked", async () => {
    const user = userEvent.setup();
    availability({ [slotKey("still-to-come", dateFor(todayRow))]: 4 });
    render(createElement(Classes, { schedule }));
    await showToday(user);
    await screen.findByText("10 left");
  });

  it("offers a class that has not started yet", async () => {
    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));
    await showToday(user);
    const row = (await screen.findByText("Later Tonight")).closest("li")!;
    await waitFor(() => assert.ok(within(row).getByRole("button", { name: /^book$/i })));
  });

  it("does not offer one that has already run", async () => {
    /*
      The bug this was written for: booking compared dates and never times,
      so at 11:30 PM the row still said Book for a class that finished hours
      before, took the booking, and answered "You're in".
    */
    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));
    await showToday(user);
    const row = (await screen.findByText("Long Over")).closest("li")!;

    await waitFor(() => assert.match(row.textContent ?? "", /started/i));
    assert.equal(within(row).queryByRole("button", { name: /^book$/i }), null);
    assert.ok(!/left/i.test(row.textContent ?? ""), "a class that is over has no places to report");
  });

  it("moves between days", async () => {
    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));

    await showToday(user);
    await screen.findByText("Later Tonight");

    const other = (todayRow + 2) % 7;
    await user.click(screen.getByRole("tab", { name: new RegExp(WEEKDAYS[other], "i") }));
    await screen.findByText(`${WEEKDAYS[other]} Class`);
    assert.equal(screen.queryByText("Later Tonight"), null, "a day's classes belong to that day");
  });

  it("offers the queue instead of a place when a class is full", async () => {
    const user = userEvent.setup();
    availability({ [slotKey("still-to-come", dateFor(todayRow))]: 14 });
    render(createElement(Classes, { schedule }));
    await showToday(user);

    const row = (await screen.findByText("Later Tonight")).closest("li")!;
    await waitFor(() => assert.match(row.textContent ?? "", /full/i));
    assert.ok(within(row).getByRole("button", { name: /waitlist/i }));
  });

  it("says you are in, rather than inviting you to book again", async () => {
    // Booking twice answered "That number is already booked onto this class"
    // in red, which is good news dressed as a failure - and left no way back
    // to the booking at all.
    const token = "c".repeat(32);
    localStorage.setItem(
      "bx:bookings",
      JSON.stringify({ [slotKey("still-to-come", dateFor(todayRow))]: token }),
    );

    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));
    await showToday(user);
    const row = (await screen.findByText("Later Tonight")).closest("li")!;

    const link = await waitFor(() => within(row).getByRole("link"));
    assert.equal(link.getAttribute("href"), `/b/${token}`);
    assert.equal(within(row).queryByRole("button", { name: /^book$/i }), null);
  });

  it("says you were in for a class you booked that has since run", async () => {
    localStorage.setItem(
      "bx:bookings",
      JSON.stringify({ [slotKey("already-run", dateFor(todayRow))]: "d".repeat(32) }),
    );

    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));
    await showToday(user);
    const row = (await screen.findByText("Long Over")).closest("li")!;
    await waitFor(() => assert.match(row.textContent ?? "", /you were in/i));
  });

  it("opens the booking dialog on the right class", async () => {
    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));
    await showToday(user);

    const row = (await screen.findByText("Later Tonight")).closest("li")!;
    await user.click(await waitFor(() => within(row).getByRole("button", { name: /^book$/i })));

    const dialog = await screen.findByRole("dialog");
    assert.match(dialog.textContent ?? "", /Later Tonight/);
  });

  it("is a tablist, and says which day is showing", async () => {
    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));

    const tabs = await screen.findAllByRole("tab");
    assert.equal(tabs.length, 7, "a week of them");
    assert.equal(tabs[0].getAttribute("aria-selected"), "true", "it opens on Saturday");

    await showToday(user);
    await waitFor(() =>
      assert.equal(screen.getByRole("tab", { name: new RegExp(WEEKDAYS[todayRow], "i") }).getAttribute("aria-selected"), "true"),
    );
  });

  it("moves between days with the arrow keys", async () => {
    // A tablist is expected to work from the keyboard, and only one tab is
    // in the tab order at a time, so the arrows are the only way through.
    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));

    const first = await screen.findByRole("tab", { name: /Saturday/i });
    first.focus();
    await user.keyboard("{ArrowRight}");

    await waitFor(() => {
      const sunday = screen.getByRole("tab", { name: /Sunday/i });
      assert.equal(sunday.getAttribute("aria-selected"), "true");
      assert.equal(document.activeElement, sunday, "focus should follow the selection");
    });
    await screen.findByText("Sunday Class");
  });

  it("still lists the classes when availability cannot be fetched", async () => {
    // The timetable is worth reading even when the count is not there.
    globalThis.fetch = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;

    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));
    await showToday(user);
    await screen.findByText("Later Tonight");
    assert.ok(!/\d+ left/i.test(document.body.textContent ?? ""));
  });

  /*
    Book is disabled until the dates are in, and the dates arrive in the
    same update as the availability. If a failed availability call had left
    that update unsent, every Book button on the site would sit there grey
    and unexplained whenever the count could not be fetched - which is
    exactly when somebody most wants to ring up and book.
  */
  it("still lets somebody book when availability cannot be fetched", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;

    const user = userEvent.setup();
    render(createElement(Classes, { schedule }));
    await showToday(user);

    const book = await screen.findByRole("button", { name: /^book$/i });
    await waitFor(() => assert.equal((book as HTMLButtonElement).disabled, false));

    await user.click(book);
    await screen.findByRole("dialog");
  });
});
