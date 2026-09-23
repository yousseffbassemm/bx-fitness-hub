import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

/*
  What the gym is told when an email does not go.
  
  Every one of these ends up on the Problems screen, read by whoever runs
  the gym rather than by whoever wrote this - so the test is about the
  words, not the status code.
*/

process.env.RESEND_API_KEY = "test-key";
process.env.NOTIFY_EMAIL_TO = "desk@example.com";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.BOOKINGS_DB_PATH = ":memory:";

const { notifyNewEnquiry, notifyPromoted } = await import("../src/lib/notify.ts");

const realFetch = globalThis.fetch;
const reported: string[] = [];

/** Catch what would have gone to the Problems screen. */
const realError = console.error;

beforeEach(() => {
  reported.length = 0;
  console.error = (...args: unknown[]) => reported.push(args.map(String).join(" "));
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
});

const refuseWith = (status: number, body: unknown) => {
  globalThis.fetch = (async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as typeof fetch;
};

const enquiry = {
  id: "1",
  name: "Karma",
  phone: "01111111111",
  email: "karma@example.com",
  goal: "Build Muscle",
};

describe("when the provider refuses", () => {
  it("says the account is still in test mode, and what to do", async () => {
    // The one this site is actually hitting: a Resend account with no
    // verified domain can only email the address it was opened with.
    refuseWith(403, {
      statusCode: 403,
      name: "validation_error",
      message:
        "You can only send testing emails to your own email address (owner@example.com). " +
        "To send emails to other recipients, please verify a domain at resend.com/domains.",
    });

    await notifyNewEnquiry(enquiry);

    const said = reported.join(" ");
    assert.match(said, /test mode/i);
    assert.match(said, /resend\.com\/domains/);
    // And it must not imply the enquiry itself was lost.
    assert.match(said, /nothing is lost|enquiries screen/i);
  });

  it("names the setting when the address itself is refused", async () => {
    refuseWith(422, { statusCode: 422, message: "Invalid `to` field." });
    await notifyNewEnquiry(enquiry);
    assert.match(reported.join(" "), /NOTIFY_EMAIL_TO/);
  });

  it("says to wait when it is only too many at once", async () => {
    refuseWith(429, { message: "Too many requests" });
    await notifyNewEnquiry(enquiry);
    assert.match(reported.join(" "), /shortly|too many/i);
  });

  it("passes anything else through rather than swallowing it", async () => {
    refuseWith(500, "the provider fell over");
    await notifyNewEnquiry(enquiry);
    assert.match(reported.join(" "), /500/);
  });

  it("never lets a failed email break what it was reporting on", async () => {
    // An enquiry is saved before this runs. A provider having a bad day must
    // not turn a saved enquiry into an error the member sees.
    refuseWith(403, { message: "please verify a domain at resend.com/domains" });
    await assert.doesNotReject(() => notifyNewEnquiry(enquiry));
    await assert.doesNotReject(() => notifyPromoted("Karma", "01111111111", "Saturday at 2:00 PM"));
  });

  it("does nothing at all when no email is configured", async () => {
    const key = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    let called = 0;
    globalThis.fetch = (async () => {
      called += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await notifyNewEnquiry(enquiry);
      assert.equal(called, 0, "a gym that has not set email up should not get errors about it");
      assert.deepEqual(reported, []);
    } finally {
      process.env.RESEND_API_KEY = key;
    }
  });
});
