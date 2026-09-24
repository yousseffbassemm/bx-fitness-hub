import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import "./support/dom.ts";

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import MemberList from "../src/components/staff/MemberList.tsx";
import PaidToggle from "../src/components/staff/PaidToggle.tsx";
import type { Member } from "../src/lib/store/types.ts";
import { refreshes, resetRouter } from "./support/stubs/next-navigation.ts";

/*
  The two screens the desk uses, driven rather than photographed.

  Everything here decides whether somebody is charged for a class. The
  membership list is what booking checks a member against, and the paid
  toggle is the answer to "have they handed the money over". Both were
  written and shipped without anybody clicking them.
*/

type Call = { method: string; body: Record<string, unknown> };

let calls: Call[] = [];
let answer: (call: Call) => { status: number; body: unknown } = () => ({
  status: 200,
  body: { ok: true },
});

const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  resetRouter();
  answer = () => ({ status: 200, body: { ok: true } });
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const call = {
      method: init?.method ?? "GET",
      body: JSON.parse(String(init?.body ?? "{}")),
    };
    calls.push(call);
    const { status, body } = answer(call);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

let nextId = 0;
const member = (over: Partial<Member> = {}): Member => ({
  id: `m${++nextId}`,
  memberNo: "BX-0142",
  name: "Test Member",
  phone: "010 0000 0000",
  createdAt: "2026-01-01T00:00:00.000Z",
  endedAt: null,
  ...over,
});

const show = (members: Member[]) =>
  render(createElement(MemberList, { members }));

describe("the membership list", () => {
  it("adds somebody, then clears the form so the next one is not half theirs", async () => {
    const user = userEvent.setup();
    show([]);

    await user.type(screen.getByLabelText(/membership number/i), "BX-0207");
    await user.type(screen.getByLabelText(/^name$/i), "Karma Wael");
    await user.type(screen.getByLabelText(/^phone$/i), "010 1111 2222");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => assert.equal(calls.length, 1));
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, {
      memberNo: "BX-0207",
      name: "Karma Wael",
      phone: "010 1111 2222",
    });

    await screen.findByText(/added karma wael/i);
    assert.equal((screen.getByLabelText(/^name$/i) as HTMLInputElement).value, "");
    assert.equal((screen.getByLabelText(/^phone$/i) as HTMLInputElement).value, "");
    assert.ok(refreshes > 0, "the list has to go and re-read itself");
  });

  it("says why a member was refused, rather than looking like it worked", async () => {
    const user = userEvent.setup();
    answer = () => ({ status: 409, body: { error: "That number belongs to somebody else." } });
    show([]);

    await user.type(screen.getByLabelText(/^name$/i), "Karma Wael");
    await user.type(screen.getByLabelText(/^phone$/i), "010 1111 2222");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    const alert = await screen.findByRole("alert");
    assert.match(alert.textContent ?? "", /belongs to somebody else/i);
    // The form keeps what was typed: retyping it is the last thing they want.
    assert.equal((screen.getByLabelText(/^name$/i) as HTMLInputElement).value, "Karma Wael");
  });

  it("asks before removing somebody, and does nothing until it is answered", async () => {
    const user = userEvent.setup();
    show([member({ name: "Karma Wael" })]);

    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    assert.equal(calls.length, 0, "Remove on its own must not delete anybody");
    await screen.findByText(/remove karma\?/i);

    // Changing your mind leaves them alone.
    await user.click(screen.getByRole("button", { name: /^keep$/i }));
    assert.equal(calls.length, 0);

    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    await user.click(screen.getByRole("button", { name: /^yes$/i }));
    await waitFor(() => assert.equal(calls.length, 1));
    assert.equal(calls[0].method, "DELETE");
  });

  it("lapses and reinstates without losing the row", async () => {
    const user = userEvent.setup();
    const { unmount } = show([member({ id: "m-live", endedAt: null })]);

    await user.click(screen.getByRole("button", { name: /mark lapsed/i }));
    await waitFor(() => assert.equal(calls.length, 1));
    assert.deepEqual(calls[0], { method: "PATCH", body: { id: "m-live", ended: true } });
    unmount();

    // The same member, now lapsed, is offered the other way round.
    show([member({ id: "m-live", endedAt: "2026-02-01T00:00:00.000Z" })]);
    // Exactly "Lapsed": the button beside it says "Mark lapsed", and the
    // note underneath explains what lapsing is.
    assert.ok(screen.getByText("Lapsed"), "a lapsed membership has to look lapsed");
    await user.click(screen.getByRole("button", { name: /reinstate/i }));
    await waitFor(() => assert.equal(calls.length, 2));
    assert.deepEqual(calls[1], { method: "PATCH", body: { id: "m-live", ended: false } });
  });

  it("edits a member without the add fields taking the typing", async () => {
    const user = userEvent.setup();
    show([member({ id: "m-edit", name: "Karma Wael", memberNo: "BX-0142" })]);

    await user.click(screen.getByRole("button", { name: /^edit$/i }));

    // The add row is disabled while a row is open, so a correction cannot
    // land as a new member instead.
    const addName = screen.getAllByLabelText(/^name$/i)[0] as HTMLInputElement;
    assert.equal(addName.disabled, true, "the add form must be out of the way");

    const rowName = screen.getAllByLabelText(/^name$/i)[1] as HTMLInputElement;
    assert.equal(rowName.value, "Karma Wael", "editing starts from what is there");
    await user.clear(rowName);
    await user.type(rowName, "Karma W. Ali");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => assert.equal(calls.length, 1));
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].body.id, "m-edit");
    assert.equal(calls[0].body.name, "Karma W. Ali");
  });

  it("finds one member among many, and says so when nobody matches", async () => {
    const user = userEvent.setup();
    const many = [
      member({ name: "Karma Wael", memberNo: "BX-0001", phone: "010 1111 1111" }),
      member({ name: "Nourhan Kamal", memberNo: "BX-0002", phone: "010 2222 2222" }),
      ...Array.from({ length: 5 }, (_, i) =>
        member({ name: `Member ${i}`, memberNo: `BX-01${i}`, phone: `010 9999 000${i}` }),
      ),
    ];
    show(many);

    const search = screen.getByLabelText(/search members/i);
    await user.type(search, "nourhan");
    await waitFor(() => {
      assert.ok(screen.queryByText("Nourhan Kamal"));
      assert.equal(screen.queryByText("Karma Wael"), null);
    });

    // By number, and by phone, because those are what the desk is holding.
    await user.clear(search);
    await user.type(search, "BX-0001");
    await waitFor(() => assert.ok(screen.queryByText("Karma Wael")));

    await user.clear(search);
    await user.type(search, "2222 2222");
    await waitFor(() => assert.ok(screen.queryByText("Nourhan Kamal")));

    await user.clear(search);
    await user.type(search, "nobody at all");
    await screen.findByText(/nobody matches that/i);
  });
});

describe("importing a pasted list", () => {
  const openImport = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /paste a list/i }));
    return screen.getByLabelText(/one per line/i);
  };

  it("counts what it found before anything is sent", async () => {
    const user = userEvent.setup();
    show([]);
    const box = await openImport(user);

    // Commas, tabs and semicolons; three columns and two; blank lines
    // ignored. A list copied out of a spreadsheet arrives like this.
    await user.click(box);
    await user.paste(
      [
        "BX-0142, Karma Wael, 010 0000 0000",
        "BX-0143\tNourhan Kamal\t010 0000 0001",
        "Mostafa Adel; 010 0000 0002",
        "",
        "   ",
        "not-a-member-line",
      ].join("\n"),
    );

    await screen.findByRole("button", { name: /add 3$/i });
    assert.equal(calls.length, 0, "counting is not sending");
  });

  it("sends one member per line and names the ones that did not land", async () => {
    const user = userEvent.setup();
    answer = (call) =>
      call.body.name === "Nourhan Kamal"
        ? { status: 409, body: { error: "duplicate-number" } }
        : { status: 200, body: { ok: true } };

    show([]);
    const box = await openImport(user);
    await user.click(box);
    await user.paste(
      ["BX-0142, Karma Wael, 010 0000 0000", "BX-0142, Nourhan Kamal, 010 0000 0001"].join("\n"),
    );
    await user.click(screen.getByRole("button", { name: /add 2$/i }));

    await waitFor(() => assert.equal(calls.length, 2));
    assert.deepEqual(calls[0].body, {
      memberNo: "BX-0142",
      name: "Karma Wael",
      phone: "010 0000 0000",
    });

    // A half-done import that says "Added 2" is how a list ends up untrue.
    const note = await screen.findByText(/added 1/i);
    assert.match(note.textContent ?? "", /Nourhan Kamal/);
  });

  it("refuses a paste with nothing member-shaped in it", async () => {
    const user = userEvent.setup();
    show([]);
    const box = await openImport(user);
    await user.click(box);
    await user.paste("just some words\nand some more");

    await user.click(screen.getByRole("button", { name: /add 0$/i }));
    const alert = await screen.findByRole("alert");
    assert.match(alert.textContent ?? "", /nothing in there looked like a member/i);
    assert.equal(calls.length, 0);
  });
});

describe("the paid toggle", () => {
  it("says who owes and who has paid, and flips", async () => {
    const user = userEvent.setup();
    render(createElement(PaidToggle, { id: "b1", paid: false }));

    const button = screen.getByRole("button");
    assert.equal(button.getAttribute("aria-pressed"), "false");
    assert.match(button.textContent ?? "", /owes/i);

    await user.click(button);
    await waitFor(() => assert.equal(calls.length, 1));
    assert.deepEqual(calls[0], { method: "PATCH", body: { id: "b1", action: "paid" } });
    assert.ok(refreshes > 0, "the list has to re-read or the row stays wrong");
  });

  it("undoes a tap that was not meant", async () => {
    const user = userEvent.setup();
    render(createElement(PaidToggle, { id: "b1", paid: true }));

    const button = screen.getByRole("button");
    assert.equal(button.getAttribute("aria-pressed"), "true");
    await user.click(button);
    await waitFor(() => assert.equal(calls.length, 1));
    assert.equal(calls[0].body.action, "unpaid");
  });

  it("does not claim money was taken when the save failed", async () => {
    const user = userEvent.setup();
    answer = () => ({ status: 503, body: { error: "nope" } });
    render(createElement(PaidToggle, { id: "b1", paid: false }));

    await user.click(screen.getByRole("button"));
    // The worst outcome here is a row that reads "Paid" when nothing saved.
    await screen.findByRole("button", { name: /try again/i });
    assert.equal(refreshes, 0, "nothing saved, so nothing to re-read");
  });
});
