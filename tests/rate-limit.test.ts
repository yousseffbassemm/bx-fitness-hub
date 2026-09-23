import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allow, callerKey, LIMITS, tooManyMessage } from "../src/lib/rate-limit.ts";

describe("the rate limiter", () => {
  it("allows up to the limit and then stops", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      assert.equal(allow(key, 3, 60_000), true, `call ${i + 1} should be allowed`);
    }
    assert.equal(allow(key, 3, 60_000), false, "the fourth is one too many");
  });

  it("counts each caller separately", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    assert.equal(allow(a, 1, 60_000), true);
    assert.equal(allow(a, 1, 60_000), false);
    assert.equal(allow(b, 1, 60_000), true, "one caller must not spend another's budget");
  });

  it("forgets once the window has passed", async () => {
    const key = `window-${Math.random()}`;
    assert.equal(allow(key, 1, 20), true);
    assert.equal(allow(key, 1, 20), false);
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(allow(key, 1, 20), true, "a new window starts clean");
  });

  it("keeps the enquiry budget tighter than the booking one", () => {
    // An enquiry is a person typing their details; a booking is a tap.
    assert.ok(LIMITS.lead.limit < LIMITS.booking.limit);
    assert.ok(LIMITS.lead.windowMs > 0 && LIMITS.booking.windowMs > 0);
  });

  it("tells the caller to wait, not to try again", () => {
    assert.match(tooManyMessage, /wait/i);
  });

  describe("callerKey", () => {
    const req = (headers: Record<string, string>) =>
      new Request("https://example.test/api/lead", { headers });

    it("uses the first address in x-forwarded-for", () => {
      // Behind the tunnel that header carries the real visitor, which is why
      // one visitor cannot spend everyone else's budget.
      assert.equal(callerKey(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
      assert.equal(callerKey(req({ "x-forwarded-for": "  1.2.3.4  " })), "1.2.3.4");
    });

    it("falls back to x-real-ip, then to a shared key", () => {
      assert.equal(callerKey(req({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
      assert.equal(callerKey(req({})), "unknown");
    });
  });
});
