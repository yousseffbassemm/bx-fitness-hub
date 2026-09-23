import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import "./support/dom.ts";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import LeadForm from "../src/components/LeadForm.tsx";

/*
  The enquiry form: the one thing on the site that turns a visitor into a
  phone call the gym can make.
*/

const realFetch = globalThis.fetch;
let sent: unknown = null;

const answerWith = (status: number, body: unknown) => {
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
};

async function fillIn(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/name/i), "Karma");
  await user.type(screen.getByLabelText(/phone/i), "01111111111");
  await user.type(screen.getByLabelText(/email/i), "karma@example.com");
  await user.selectOptions(screen.getByLabelText(/goal/i), "Build Muscle");
}

beforeEach(() => {
  sent = null;
  answerWith(200, { ok: true, id: "1" });
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

describe("the enquiry form", () => {
  it("sends what was typed and confirms it landed", async () => {
    const user = userEvent.setup();
    render(createElement(LeadForm));

    await fillIn(user);
    await user.click(screen.getByRole("button", { name: /start my journey/i }));

    await waitFor(() => assert.match(document.body.textContent ?? "", /you.?re on the list/i));
    assert.deepEqual(sent, {
      name: "Karma",
      phone: "01111111111",
      email: "karma@example.com",
      goal: "Build Muscle",
    });
  });

  it("asks for what is missing before troubling the gym", async () => {
    const user = userEvent.setup();
    let called = 0;
    globalThis.fetch = (async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    render(createElement(LeadForm));
    await user.click(screen.getByRole("button", { name: /start my journey/i }));

    assert.equal(called, 0);
    const text = document.body.textContent ?? "";
    assert.match(text, /enter your name/i);
    assert.match(text, /phone number/i);
    assert.match(text, /valid email/i);
    assert.match(text, /goal/i);
  });

  it("clears a complaint as soon as it is answered", async () => {
    const user = userEvent.setup();
    render(createElement(LeadForm));

    await user.click(screen.getByRole("button", { name: /start my journey/i }));
    assert.match(document.body.textContent ?? "", /enter your name/i);

    await user.type(screen.getByLabelText(/name/i), "K");
    assert.ok(!/enter your name/i.test(document.body.textContent ?? ""));
  });

  it("refuses an email that is not one", async () => {
    const user = userEvent.setup();
    render(createElement(LeadForm));

    await user.type(screen.getByLabelText(/name/i), "Karma");
    await user.type(screen.getByLabelText(/phone/i), "01111111111");
    await user.type(screen.getByLabelText(/email/i), "karma@");
    await user.selectOptions(screen.getByLabelText(/goal/i), "Build Muscle");
    await user.click(screen.getByRole("button", { name: /start my journey/i }));

    assert.match(document.body.textContent ?? "", /valid email/i);
    assert.equal(sent, null);
  });

  it("says to wait when the answer is to wait, not to try again", async () => {
    /*
      The bug this test exists for. The form threw the server's answer away
      and showed one line for every failure: "please try again". On a 429
      that is the one thing not to do - the server had just said to wait a
      few minutes - and trying again immediately fails again.
    */
    const user = userEvent.setup();
    answerWith(429, { error: "That is a lot of requests in a short time. Please wait a few minutes, or call us." });

    render(createElement(LeadForm));
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: /start my journey/i }));

    await waitFor(() => assert.match(document.body.textContent ?? "", /wait a few minutes/i));
    assert.ok(
      !/please try again/i.test(document.body.textContent ?? ""),
      "trying again immediately is exactly what will not work",
    );
  });

  it("passes on the answer when the records cannot be reached", async () => {
    const user = userEvent.setup();
    answerWith(503, { error: "Could not save that just now. Please call us instead." });

    render(createElement(LeadForm));
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: /start my journey/i }));

    await waitFor(() => assert.match(document.body.textContent ?? "", /call us/i));
    // And it must not claim the enquiry is safe when it is not.
    assert.ok(!/you.?re on the list/i.test(document.body.textContent ?? ""));
  });

  it("falls back to its own words when the request never arrived", async () => {
    const user = userEvent.setup();
    globalThis.fetch = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;

    render(createElement(LeadForm));
    await fillIn(user);
    await user.click(screen.getByRole("button", { name: /start my journey/i }));

    await waitFor(() => assert.match(document.body.textContent ?? "", /something went wrong/i));
  });

  it("does not send twice while it is sending", async () => {
    const user = userEvent.setup();
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 40));
      return new Response(JSON.stringify({ ok: true, id: "1" }), { status: 200 });
    }) as typeof fetch;

    render(createElement(LeadForm));
    await fillIn(user);
    const submit = screen.getByRole("button", { name: /start my journey/i });
    await user.click(submit);
    await user.click(submit).catch(() => {});

    await waitFor(() => assert.match(document.body.textContent ?? "", /you.?re on the list/i));
    assert.equal(calls, 1, "a double tap must not make two enquiries");
  });
});
