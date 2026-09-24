import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

/*
  The gate in front of the staff area.

  This runs before a staff page renders, which is the whole point: a member's
  name and phone number must never be produced at all - not even into a
  streamed payload that is thrown away - for somebody without a session. The
  API routes check for themselves too, but pages have no such guard of their
  own, so this file is the only thing between the membership list and anyone
  who types the URL.

  It had no tests.
*/

process.env.STAFF_SESSION_SECRET = "a-test-secret-long-enough-to-be-accepted-0123456789";

const { proxy, config } = await import("../src/proxy.ts");
const { createSessionToken, STAFF_COOKIE } = await import("../src/lib/staff/session.ts");
const { NextRequest } = await import("next/server");

const SITE = "https://bx.test";

let valid = "";
before(async () => {
  valid = await createSessionToken("boss");
});

/** A request for a staff URL, with or without a session cookie. */
function ask(path: string, cookie?: string) {
  return new NextRequest(new URL(path, SITE), {
    headers: cookie ? { cookie: `${STAFF_COOKIE}=${cookie}` } : {},
  });
}

/** Where the proxy sent them, or null if it let them through. */
async function sentTo(path: string, cookie?: string) {
  const res = await proxy(ask(path, cookie));
  const location = res.headers.get("location");
  return location ? new URL(location) : null;
}

describe("the staff gate", () => {
  it("sends somebody with no session to the login screen", async () => {
    for (const path of ["/staff", "/staff/members", "/staff/team", "/staff/errors"]) {
      const to = await sentTo(path);
      assert.equal(to?.pathname, "/staff/login", `${path} must not render`);
    }
  });

  it("lets a real session through", async () => {
    for (const path of ["/staff", "/staff/members", "/staff/timetable"]) {
      assert.equal(await sentTo(path, valid), null, `${path} should open`);
    }
  });

  it("refuses a cookie that is not ours", async () => {
    // A signature is the only thing separating these from the real one.
    const forged = [
      "",
      "nonsense",
      `${valid}x`,
      valid.slice(0, -1),
      valid.replace(/.$/, valid.at(-1) === "a" ? "b" : "a"),
      Buffer.from('{"u":"boss","exp":9999999999}').toString("base64url"),
    ];
    for (const cookie of forged) {
      const to = await sentTo("/staff/members", cookie);
      assert.equal(
        to?.pathname,
        "/staff/login",
        `a cookie of ${JSON.stringify(cookie.slice(0, 24))} must not get in`,
      );
    }
  });

  it("brings them back to the page they wanted after signing in", async () => {
    const to = await sentTo("/staff/members");
    assert.equal(to?.searchParams.get("next"), "/staff/members");
  });

  it("does not bother with a next for the list itself", async () => {
    const to = await sentTo("/staff");
    assert.equal(to?.searchParams.get("next"), null, "/staff is where login lands anyway");
  });

  it("does not ask somebody already signed in to sign in again", async () => {
    const to = await sentTo("/staff/login", valid);
    assert.equal(to?.pathname, "/staff", "a signed-in person on the login page belongs at the list");
  });

  it("shows the login screen to somebody who is not signed in", async () => {
    assert.equal(await sentTo("/staff/login"), null);
  });

  it("covers every staff page, not just the ones that exist today", () => {
    // A new screen must be guarded by existing, not by somebody remembering.
    assert.deepEqual(config.matcher, ["/staff", "/staff/:path*"]);
  });
});
