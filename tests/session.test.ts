import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.STAFF_SESSION_SECRET = "a-test-secret-long-enough-to-be-accepted-0123456789";

const {
  SESSION_SECONDS,
  USERNAME_PATTERN,
  createSessionToken,
  readSessionToken,
  staffAuthConfigured,
  verifySessionToken,
} = await import("../src/lib/staff/session.ts");

/**
 * A token with whatever expiry we like, signed the way the real one is.
 *
 * The test knows the secret, so it can mint the one case createSessionToken
 * will not: a valid signature over an expiry that has already passed.
 */
async function signedToken(username: string, expires: number) {
  const payload = `${username}.${expires}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.STAFF_SESSION_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${Buffer.from(sig).toString("base64url")}`;
}

/*
  The staff gate runs on the Edge with no database, so a signed token is the
  whole of the proof. Everything here is about what must NOT get through.
*/

describe("staff session tokens", () => {
  it("is configured when there is a long enough secret", () => {
    assert.equal(staffAuthConfigured(), true);
  });

  it("round-trips a username", async () => {
    const token = await createSessionToken("youssef");
    assert.ok(token);
    assert.equal(await readSessionToken(token), "youssef");
    assert.equal(await verifySessionToken(token), true);
  });

  it("carries an expiry about a shift long", async () => {
    const token = (await createSessionToken("youssef"))!;
    const expires = Number(token.split(".")[1]);
    const wanted = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    assert.ok(Math.abs(expires - wanted) < 5, "expiry should be SESSION_SECONDS away");
  });

  it("refuses a token whose signature does not match", async () => {
    const token = (await createSessionToken("youssef"))!;
    const [user, expires, signature] = token.split(".");

    assert.equal(await readSessionToken(`${user}.${expires}.${"A".repeat(signature.length)}`), null);
    // Same signature, different claim: the point of signing the payload.
    assert.equal(await readSessionToken(`karma.${expires}.${signature}`), null);
    assert.equal(await readSessionToken(`${user}.${Number(expires) + 3600}.${signature}`), null);
  });

  it("refuses a token that has run out", async () => {
    /*
      Signed properly, and only the clock is against it. A garbage signature
      would be refused for that reason instead, and the expiry check could be
      deleted without this noticing - which is exactly what happened the first
      time this test was written.
    */
    const expired = await signedToken("youssef", Math.floor(Date.now() / 1000) - 1);
    assert.equal(await readSessionToken(expired), null);

    // And one second the other way still works, so it is the clock deciding.
    const live = await signedToken("youssef", Math.floor(Date.now() / 1000) + 60);
    assert.equal(await readSessionToken(live), "youssef");
  });

  it("refuses anything that is not a token", async () => {
    for (const bad of [undefined, "", "not-a-token", "a.b", "...", "youssef..sig", "youssef.notanumber.sig"]) {
      assert.equal(await readSessionToken(bad), null, `should refuse ${JSON.stringify(bad)}`);
    }
  });

  it("refuses a username outside the pattern, even correctly signed", async () => {
    // Usernames go in a dot-separated token, so a dot in one would split it.
    assert.equal(await createSessionToken("has.a.dot"), null);
    assert.equal(await createSessionToken("Youssef"), null, "uppercase is not in the pattern");
    assert.equal(await createSessionToken("ab"), null, "too short");
    assert.equal(await createSessionToken("z".repeat(33)), null, "too long");
    assert.equal(USERNAME_PATTERN.test("floor_staff-2"), true);
  });

  it("fails closed when there is no secret to sign with", async () => {
    const kept = process.env.STAFF_SESSION_SECRET;
    process.env.STAFF_SESSION_SECRET = "too-short";
    try {
      assert.equal(staffAuthConfigured(), false);
      assert.equal(await createSessionToken("youssef"), null);
      // And nothing minted earlier is honoured either.
      assert.equal(await readSessionToken("youssef.9999999999.sig"), null);
    } finally {
      process.env.STAFF_SESSION_SECRET = kept;
    }
  });
});
