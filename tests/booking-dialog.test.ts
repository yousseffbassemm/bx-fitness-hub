import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import "./support/dom.ts";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import BookingDialog, { type BookingTarget } from "../src/components/BookingDialog.tsx";

/*
  The dialog, driven rather than photographed.

  This is the one place on the site where a member commits to something, and
  everything below - where focus lands, whether Tab escapes, what Escape
  does, what it says when the gym's answer is not what was hoped - was only
  ever verified by somebody clicking it once.
*/

const TARGET: BookingTarget = {
  id: "0-200-mobility-flexibility",
  date: "2026-09-26",
  session: { time: "2:00 PM", coach: "Nourhan Kamal", discipline: "Mobility & Flexibility" },
  spotsLeft: 10,
  mode: "book",
};

let closed = 0;
let booked: unknown[] = [];
const realFetch = globalThis.fetch;

/** Answer the booking endpoint with whatever a test needs it to say. */
function answerWith(status: number, body: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

/**
 * Answer "are you a member?" with guest, which is where the name and phone
 * live. The question itself, and the member branch, have their own tests.
 */
async function asGuest(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /guest/i }));
}

const open = (over: Partial<BookingTarget> = {}) =>
  render(
    createElement(BookingDialog, {
      target: { ...TARGET, ...over },
      onClose: () => {
        closed += 1;
      },
      onBooked: (...args: unknown[]) => booked.push(args),
    }),
  );

beforeEach(() => {
  closed = 0;
  booked = [];
  answerWith(200, { ok: true, spotsLeft: 9, token: "a".repeat(32) });
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  document.body.style.overflow = "";
});

describe("opening the dialog", () => {
  it("asks whether you are a member before anything else", async () => {
    // It changes what is asked next and what happens at the desk, so it is
    // the first question rather than a checkbox further down.
    open();
    await screen.findByRole("button", { name: /member/i });
    await screen.findByRole("button", { name: /guest/i });
    assert.equal(screen.queryByLabelText(/name/i), null, "nothing else is asked yet");
  });

  it("puts the cursor on that question", async () => {
    open();
    await waitFor(() => assert.match(document.activeElement?.textContent ?? "", /member/i));
  });

  it("asks a guest for a name, a phone and how they will pay", async () => {
    const user = userEvent.setup();
    open();
    await asGuest(user);
    await screen.findByLabelText(/name/i);
    await screen.findByLabelText(/phone/i);
    await screen.findByLabelText(/paying by/i);
  });

  it("stops the page behind it scrolling", () => {
    open();
    assert.equal(document.body.style.overflow, "hidden");
  });

  it("gives the page back when it closes", () => {
    const { unmount } = open();
    unmount();
    assert.equal(document.body.style.overflow, "");
  });

  it("returns the cursor to whatever opened it", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Book";
    document.body.append(opener);
    opener.focus();

    const { unmount } = open();
    await waitFor(() => assert.notEqual(document.activeElement, opener));
    unmount();
    assert.equal(document.activeElement, opener, "a keyboard user must not be dropped at the top of the page");
    opener.remove();
  });
});

describe("keyboard", () => {
  it("keeps Tab inside the dialog", async () => {
    const user = userEvent.setup();
    open();
    await asGuest(user);
    const panel = screen.getByRole("dialog");
    await waitFor(() => assert.ok(panel.contains(document.activeElement)));

    // All the way round, twice over, and it must never land on the page.
    for (let i = 0; i < 12; i++) {
      await user.tab();
      assert.ok(
        panel.contains(document.activeElement),
        `Tab ${i + 1} escaped the dialog to ${document.activeElement?.tagName}`,
      );
    }
  });

  it("keeps Shift+Tab inside it too", async () => {
    const user = userEvent.setup();
    open();
    await asGuest(user);
    const panel = screen.getByRole("dialog");
    await waitFor(() => assert.ok(panel.contains(document.activeElement)));

    for (let i = 0; i < 12; i++) {
      await user.tab({ shift: true });
      assert.ok(panel.contains(document.activeElement), `Shift+Tab ${i + 1} escaped`);
    }
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    open();
    await user.keyboard("{Escape}");
    await waitFor(() => assert.equal(closed, 1));
  });
});

describe("taking a place", () => {
  it("asks the gym and says you are in", async () => {
    const user = userEvent.setup();
    let sent: { url: string; body: unknown } | null = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ ok: true, spotsLeft: 9, token: "b".repeat(32) }), { status: 200 });
    }) as unknown as typeof fetch;

    open();
    await asGuest(user);
    await user.type(screen.getByLabelText(/name/i), "Karma");
    await user.type(screen.getByLabelText(/phone/i), "01111111111");
    await user.click(screen.getByRole("button", { name: /confirm place/i }));

    await waitFor(() => assert.match(document.body.textContent ?? "", /you.?re in/i));
    assert.equal(sent!.url, "/api/classes/book");
    assert.deepEqual(sent!.body, {
      sessionId: TARGET.id,
      date: TARGET.date,
      name: "Karma",
      phone: "01111111111",
      payment: "cash",
    });
    assert.equal(booked.length, 1, "the timetable row has to hear about it too");
  });

  it("shows the link back to the booking, so the place can be given up later", async () => {
    const user = userEvent.setup();
    open();
    await asGuest(user);
    await user.type(screen.getByLabelText(/name/i), "Karma");
    await user.type(screen.getByLabelText(/phone/i), "01111111111");
    await user.click(screen.getByRole("button", { name: /confirm place/i }));

    // Shown once, here, and nowhere else - it is the only handle a member
    // without an account has on their own booking.
    const shown = await screen.findByText(new RegExp(`/b/a{32}`));
    assert.ok(shown.textContent?.includes(`/b/${"a".repeat(32)}`));
  });

  it("copies that link to the clipboard and says it did", async () => {
    const user = userEvent.setup();
    open();
    await asGuest(user);
    await user.type(screen.getByLabelText(/name/i), "Karma");
    await user.type(screen.getByLabelText(/phone/i), "01111111111");
    await user.click(screen.getByRole("button", { name: /confirm place/i }));

    const copy = await screen.findByRole("button", { name: /^copy$/i });
    await user.click(copy);

    assert.match(await window.navigator.clipboard.readText(), /\/b\/a{32}/);
    await waitFor(() => assert.match(copy.textContent ?? "", /copied/i));
  });

  it("will not send a blank name or a number that is not one", async () => {
    const user = userEvent.setup();
    let called = 0;
    globalThis.fetch = (async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    open();
    await asGuest(user);
    await user.click(screen.getByRole("button", { name: /confirm place/i }));
    await user.type(screen.getByLabelText(/name/i), "K");
    await user.type(screen.getByLabelText(/phone/i), "abc");
    await user.click(screen.getByRole("button", { name: /confirm place/i }));

    assert.equal(called, 0, "the gym should not be asked about a form that is not filled in");
    assert.match(document.body.textContent ?? "", /name|number/i);
  });

  it("says what the gym said when it refuses", async () => {
    const user = userEvent.setup();
    answerWith(409, { error: "This class just filled up.", reason: "full" });

    open();
    await asGuest(user);
    await user.type(screen.getByLabelText(/name/i), "Karma");
    await user.type(screen.getByLabelText(/phone/i), "01111111111");
    await user.click(screen.getByRole("button", { name: /confirm place/i }));

    await waitFor(() => assert.match(document.body.textContent ?? "", /just filled up/i));
  });

  it("treats an already-booked number as good news, not a failure", async () => {
    // It reaches this dialog only when the device that booked is not this
    // one. It was being shown in the same red as a real error.
    const user = userEvent.setup();
    answerWith(409, { error: "That number is already booked onto this class.", reason: "duplicate" });

    open();
    await asGuest(user);
    await user.type(screen.getByLabelText(/name/i), "Karma");
    await user.type(screen.getByLabelText(/phone/i), "01111111111");
    await user.click(screen.getByRole("button", { name: /confirm place/i }));

    await waitFor(() => assert.match(document.body.textContent ?? "", /already/i));
  });

  it("says the gym is unreachable rather than nothing at all", async () => {
    const user = userEvent.setup();
    globalThis.fetch = (async () => {
      throw new TypeError("network down");
    }) as typeof fetch;

    open();
    await asGuest(user);
    await user.type(screen.getByLabelText(/name/i), "Karma");
    await user.type(screen.getByLabelText(/phone/i), "01111111111");
    await user.click(screen.getByRole("button", { name: /confirm place/i }));

    await waitFor(() => assert.match(document.body.textContent ?? "", /\w/));
    assert.ok(
      /could not|try again|call/i.test(document.body.textContent ?? ""),
      "a member staring at a dead form needs to be told something",
    );
  });
});

describe("a full class", () => {
  it("offers the queue and asks the waitlist endpoint", async () => {
    const user = userEvent.setup();
    let url = "";
    globalThis.fetch = (async (target: string) => {
      url = target;
      return new Response(JSON.stringify({ ok: true, position: 2 }), { status: 200 });
    }) as unknown as typeof fetch;

    open({ mode: "waitlist", spotsLeft: 0 });
    await asGuest(user);
    await user.type(screen.getByLabelText(/name/i), "Karma");
    await user.type(screen.getByLabelText(/phone/i), "01111111111");
    await user.click(screen.getByRole("button", { name: /waitlist|list|join/i }));

    await waitFor(() => assert.equal(url, "/api/classes/waitlist"));
    await waitFor(() => assert.match(document.body.textContent ?? "", /2|queue|list/i));
  });
});
