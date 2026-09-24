import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

/*
  The Supabase store's photograph fetch, and the one thing it retries.

  Every request here is stubbed. Nothing in this file is allowed to reach a
  real host: the URL below is not BX's, and the assertion under it says so.
*/

process.env.SUPABASE_URL = "https://not-a-real-project.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "not-a-real-key";

const { supabaseStore, supabaseConfigured } = await import("../src/lib/store/supabase.ts");
assert.equal(supabaseConfigured, true, "the stub store has to be the one in use");

const realFetch = globalThis.fetch;
let calls: string[] = [];

/** A PostgREST answer holding one upload. */
const oneRow = (b64: string) =>
  new Response(JSON.stringify([{ mime: "image/png", bytes_b64: b64 }]), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fetching a photograph from Supabase", () => {
  it("asks again when the transfer breaks part way", async () => {
    // This is what a dropped connection looks like: a TypeError with no
    // status to inspect. It happened in production on a cold request.
    globalThis.fetch = (async (input: string) => {
      calls.push(String(input));
      if (calls.length === 1) throw new TypeError("terminated");
      return oneRow(Buffer.from("a real png would be here").toString("base64"));
    }) as unknown as typeof fetch;

    const file = await supabaseStore.getUpload("abc123");
    assert.equal(calls.length, 2, "one broken transfer should not lose the photograph");
    assert.equal(file?.mime, "image/png");
    assert.equal(Buffer.from(file!.bytes).toString(), "a real png would be here");
  });

  it("gives up if it breaks twice", async () => {
    globalThis.fetch = (async () => {
      calls.push("x");
      throw new TypeError("terminated");
    }) as unknown as typeof fetch;

    await assert.rejects(() => supabaseStore.getUpload("abc123"), /terminated/);
    assert.equal(calls.length, 2, "twice, not forever - the route answers 503 after this");
  });

  it("does not repeat a refusal from Postgres", async () => {
    // A 500 or a 401 will say the same thing again. Asking twice just makes
    // somebody wait twice as long for the same failure.
    globalThis.fetch = (async () => {
      calls.push("x");
      return new Response("nope", { status: 500 });
    }) as unknown as typeof fetch;

    await assert.rejects(() => supabaseStore.getUpload("abc123"), /getUpload failed: 500/);
    assert.equal(calls.length, 1, "a refusal is an answer, not a broken transfer");
  });

  it("says nothing is there for an id nobody uploaded", async () => {
    globalThis.fetch = (async () => {
      calls.push("x");
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;

    assert.equal(await supabaseStore.getUpload("nope"), null);
    assert.equal(calls.length, 1, "an empty answer is not a failure");
  });

  it("asks for one row and two columns, not the whole table", async () => {
    // bytes_b64 is a megabyte a time. select=* here would pull every
    // photograph BX has to answer for one.
    globalThis.fetch = (async (input: string) => {
      calls.push(String(input));
      return oneRow("");
    }) as unknown as typeof fetch;

    await supabaseStore.getUpload("abc123");
    assert.match(calls[0], /select=mime,bytes_b64/);
    assert.match(calls[0], /id=eq\.abc123/);
    assert.doesNotMatch(calls[0], /select=\*/);
  });
});
