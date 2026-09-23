import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

/*
  The place a member holds is remembered in their own browser, because a
  booking has no account behind it. It is a convenience and nothing more, so
  the rule this file protects is: it may lose things, but it must never throw
  and it must never hand back something that is not a token.
*/

class FakeStorage {
  #data = new Map<string, string>();
  throwOnEverything = false;

  getItem(key: string) {
    if (this.throwOnEverything) throw new Error("storage is off in this mode");
    return this.#data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.throwOnEverything) throw new Error("storage is off in this mode");
    this.#data.set(key, value);
  }
  raw(key: string) {
    return this.#data.get(key) ?? null;
  }
  seed(key: string, value: string) {
    this.#data.set(key, value);
  }
  clear() {
    this.#data.clear();
  }
}

const storage = new FakeStorage();
(globalThis as { localStorage?: unknown }).localStorage = storage;

const { forgetToken, readMine, remember } = await import("../src/lib/my-bookings.ts");

const SLOT = "0-200-mobility-flexibility|2026-09-26";
const TOKEN = "fba1986552ec4e7c90279ca0d5469b81";

describe("the places this browser holds", () => {
  beforeEach(() => {
    storage.clear();
    storage.throwOnEverything = false;
  });

  it("remembers a place and reads it back", () => {
    remember(SLOT, TOKEN);
    assert.deepEqual(readMine(), { [SLOT]: TOKEN });
  });

  it("keeps several without losing the earlier ones", () => {
    remember(SLOT, TOKEN);
    remember("1-700-boxing|2026-09-27", "a".repeat(32));
    assert.equal(Object.keys(readMine()).length, 2);
  });

  it("forgets one by its token and leaves the rest", () => {
    remember(SLOT, TOKEN);
    remember("1-700-boxing|2026-09-27", "a".repeat(32));
    forgetToken(TOKEN);
    assert.deepEqual(Object.keys(readMine()), ["1-700-boxing|2026-09-27"]);
  });

  it("ignores anything stored that is not a token", () => {
    // Whatever else has been written under this key - by an old version, an
    // extension, or a person with the console open - is not ours to trust.
    storage.seed(
      "bx:bookings",
      JSON.stringify({
        good: TOKEN,
        tooShort: "abc",
        notHex: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
        aNumber: 12345,
        anObject: { nested: true },
        script: "<script>alert(1)</script>",
      }),
    );
    assert.deepEqual(readMine(), { good: TOKEN });
  });

  it("returns nothing rather than breaking on rubbish", () => {
    for (const raw of ["", "not json", "[]", "null", '"a string"', "42"]) {
      storage.seed("bx:bookings", raw);
      assert.deepEqual(readMine(), {}, `should shrug off ${JSON.stringify(raw)}`);
    }
  });

  it("survives storage being switched off", () => {
    // Private windows and blocked site data throw rather than returning null,
    // and a booking that worked must never look like one that failed.
    storage.throwOnEverything = true;
    assert.deepEqual(readMine(), {});
    assert.doesNotThrow(() => remember(SLOT, TOKEN));
    assert.doesNotThrow(() => forgetToken(TOKEN));
  });

  it("never hands back a value that is not a token, however it got there", () => {
    // remember() does store it; readMine() is the gate, and it is the only
    // thing the timetable reads, so nothing malformed reaches a link.
    remember(SLOT, "not-a-token");
    assert.deepEqual(readMine(), {});
  });
});
