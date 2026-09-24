import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashPassword, verifyPassword } from "../src/lib/staff/password.ts";

/*
  What decides whether a staff password is right.

  Everything else in the staff area rests on this one function returning
  false when it should. It had no tests at all - and the failures that
  matter here are the silent ones, where a malformed stored hash makes
  verify say yes to anything rather than throwing something somebody would
  notice.

  scrypt is deliberately slow, so these are kept few and pointed.
*/

describe("staff passwords", () => {
  it("lets the right password back in", async () => {
    const stored = await hashPassword("correct horse battery staple");
    assert.equal(await verifyPassword("correct horse battery staple", stored), true);
  });

  it("refuses the wrong one, however close", async () => {
    const stored = await hashPassword("correct horse battery staple");
    for (const wrong of [
      "correct horse battery stapl",
      "correct horse battery staple ",
      "Correct horse battery staple",
      "",
      "correct horse battery staples",
    ]) {
      assert.equal(
        await verifyPassword(wrong, stored),
        false,
        `${JSON.stringify(wrong)} must not get in`,
      );
    }
  });

  it("stores the same password differently every time", async () => {
    // A shared salt would let one rainbow table cover every account, and
    // make two people with the same password obvious from the hashes.
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("same password", a), true);
    assert.equal(await verifyPassword("same password", b), true);
  });

  it("writes a hash that survives a .env file", async () => {
    /*
      Dots, not dollars. A $-separated hash gets expanded by the shell and
      arrives truncated to "scrypt", and then nobody can sign in - so the
      format is worth pinning down.
    */
    const stored = await hashPassword("whatever");
    assert.match(stored, /^scrypt\.[0-9a-f]{32}\.[0-9a-f]{128}$/);
    assert.ok(!stored.includes("$"), "a dollar sign would be eaten by .env expansion");
  });

  it("says no to a stored value that is not a hash, rather than yes", async () => {
    const notHashes = [
      undefined,
      "",
      "scrypt",                       // what a $-separated hash truncates to
      "scrypt.",
      "scrypt.abc",
      "scrypt..",
      "plaintext",
      "bcrypt.aaaa.bbbb",
      `scrypt.${"a".repeat(32)}.`,
      `scrypt.${"a".repeat(32)}.zzzz`,        // not hex at all
      `scrypt.${"a".repeat(32)}.${"a".repeat(126)}`, // hex, but too short
      "scrypt.00.00",                 // the dummy the login route compares against
    ];
    for (const stored of notHashes) {
      assert.equal(
        await verifyPassword("anything", stored as string | undefined),
        false,
        `${JSON.stringify(stored)} must never verify`,
      );
    }
  });

  it("refuses a hash that is right in every way except the scheme", async () => {
    /*
      The other malformed cases are all caught by the length check, so on
      their own they do not prove the scheme is looked at. This one is a
      real, correct scrypt hash of the password with only the scheme word
      changed: if the scheme went unchecked it would verify, and the format
      could never be migrated to anything else safely.
    */
    const stored = await hashPassword("a real password");
    assert.equal(await verifyPassword("a real password", stored), true);

    for (const scheme of ["bcrypt", "argon2", "sha256", "SCRYPT", "scryptx", ""]) {
      const swapped = stored.replace(/^scrypt/, scheme);
      assert.equal(
        await verifyPassword("a real password", swapped),
        false,
        `a hash labelled ${JSON.stringify(scheme)} must not be treated as scrypt`,
      );
    }
  });

  it("does not throw on rubbish, because the caller would turn that into a 500", async () => {
    // The login route awaits this for an unknown user too, deliberately, so
    // a throw here would tell an attacker which usernames exist.
    for (const stored of ["...", "scrypt.zz.zz", "scrypt.a.b.c.d"]) {
      await assert.doesNotReject(() => verifyPassword("x", stored));
    }
  });

  it("handles a password somebody might actually pick", async () => {
    for (const password of ["p@ssw0rd!£$%^&*()", "كلمة السر", "🏋️‍♀️🏋️‍♂️", "a".repeat(400)]) {
      const stored = await hashPassword(password);
      assert.equal(await verifyPassword(password, stored), true, `${password.slice(0, 12)} should work`);
      assert.equal(await verifyPassword(`${password}x`, stored), false);
    }
  });
});
