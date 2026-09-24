import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import "./support/dom.ts";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import ScheduleEditor from "../src/components/staff/ScheduleEditor.tsx";
import type { ScheduleDay } from "../src/lib/content.ts";

/*
  The timetable editor, and the one control in it that cannot be taken back.

  Removing a class strands every booking on it: those rows keep a session id
  the timetable no longer has, and adding the class again does not rescue
  them, because a new row is a new class with a new id. The people are still
  coming; only the class is gone.
*/

let saved: unknown[] = [];
const realFetch = globalThis.fetch;

const SATURDAY: ScheduleDay[] = [
  {
    day: "Saturday",
    short: "Sat",
    sessions: [
      { id: "0-200-mobility-flexibility", time: "2:00 PM", coach: "Nourhan Kamal", discipline: "Mobility & Flexibility" },
      { id: "0-600-60-min-stronger", time: "6:00 PM", coach: "Farah", discipline: "60 Min Stronger" },
    ],
  },
];

const BOOKED = { "0-200-mobility-flexibility": 14 };

beforeEach(() => {
  saved = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    saved.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

const open = (booked: Record<string, number> = BOOKED) =>
  render(createElement(ScheduleEditor, { schedule: SATURDAY, bookedIds: booked }));

/** The classes left on Saturday in whatever was last sent to the server. */
const savedSessions = () => {
  const body = saved.at(-1) as { value: ScheduleDay[] };
  return body.value[0].sessions.map((s) => s.discipline);
};

describe("removing a class from the timetable", () => {
  it("asks first when people are booked on it", async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getAllByRole("button", { name: /^remove$/i })[0]);

    // Nothing has gone yet - the row is still there, now asking.
    assert.ok(screen.getByDisplayValue("Mobility & Flexibility"));
    const warning = screen.getByText(/14 booked/);
    assert.match(warning.textContent ?? "", /will not undo it/i);
    await screen.findByRole("button", { name: /remove anyway/i });
  });

  it("keeps the class, and the people on it, when the answer is Keep", async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getAllByRole("button", { name: /^remove$/i })[0]);
    await user.click(screen.getByRole("button", { name: /^keep$/i }));

    assert.ok(screen.getByDisplayValue("Mobility & Flexibility"), "it must still be there");
    assert.equal(screen.queryByRole("button", { name: /remove anyway/i }), null);
  });

  it("removes it on the second press, when that is really meant", async () => {
    const user = userEvent.setup();
    open();

    await user.click(screen.getAllByRole("button", { name: /^remove$/i })[0]);
    await user.click(screen.getByRole("button", { name: /remove anyway/i }));

    assert.equal(screen.queryByDisplayValue("Mobility & Flexibility"), null);
    await user.click(screen.getByRole("button", { name: /save timetable/i }));
    await waitFor(() => assert.equal(saved.length, 1));
    assert.deepEqual(savedSessions(), ["60 Min Stronger"]);
  });

  it("does not ask about a class nobody has booked", async () => {
    const user = userEvent.setup();
    open({});

    await user.click(screen.getAllByRole("button", { name: /^remove$/i })[0]);

    // No bookings to strand, so it is just a row - it goes straight away.
    assert.equal(screen.queryByDisplayValue("Mobility & Flexibility"), null);
    assert.equal(screen.queryByRole("button", { name: /remove anyway/i }), null);
  });
});
