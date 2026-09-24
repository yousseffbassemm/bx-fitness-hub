import assert from "node:assert/strict";
import { describe, it } from "node:test";

/*
  Which store a deploy ends up using, and the one case where it must refuse.

  Falling back to SQLite is right on a single server and wrong on a
  serverless host: the filesystem is either read only, so every booking
  fails, or per-instance and wiped on the next deploy, so bookings are
  taken, confirmed, and quietly gone. The second is the one nobody notices
  until somebody turns up for a class they are not on.
*/

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { unconfiguredHostError } = await import("../src/lib/store/host-check.ts");

describe("choosing a store", () => {
  it("stops a hosted deploy that has no database", () => {
    for (const env of [{ VERCEL: "1" }, { BX_REQUIRE_SUPABASE: "1" }, { VERCEL: "1", CI: "true" }]) {
      const message = unconfiguredHostError(env);
      assert.ok(message, `${JSON.stringify(env)} must not be allowed to start`);
      // Naming both is the whole value: the failure it prevents looks like
      // a database outage, not like missing configuration.
      assert.match(message!, /SUPABASE_URL/);
      assert.match(message!, /SUPABASE_SERVICE_ROLE_KEY/);
    }
  });

  it("leaves a local build and CI alone", () => {
    // Both deliberately run without Supabase - CI proves the tests never
    // touch the real database, and SQLite is the point on one server.
    for (const env of [{}, { CI: "true" }, { NODE_ENV: "production" }, { NODE_ENV: "test" }]) {
      assert.equal(
        unconfiguredHostError(env),
        null,
        `${JSON.stringify(env)} should carry on with SQLite`,
      );
    }
  });

  it("says nothing once a database is configured", () => {
    // The hosted flags stop mattering the moment there is a real database.
    for (const env of [{ VERCEL: "1" }, { BX_REQUIRE_SUPABASE: "1" }, {}]) {
      assert.equal(unconfiguredHostError(env, true), null, JSON.stringify(env));
    }
  });

  it("is the unconfigured half that decides, not the host alone", () => {
    // Both halves have to be true for it to refuse, so neither check can be
    // dropped without this failing.
    assert.ok(unconfiguredHostError({ VERCEL: "1" }, false));
    assert.equal(unconfiguredHostError({ VERCEL: "1" }, true), null);
    assert.equal(unconfiguredHostError({}, false), null);
  });
});
