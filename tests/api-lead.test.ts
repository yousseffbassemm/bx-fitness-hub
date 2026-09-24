import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import { post, read } from "./support/http.ts";

/*
  The "Start here" form's endpoint - how BX hears from anybody at all.

  It had no tests. The failure that matters is not a 500: it is answering
  "we'll be in touch" for an enquiry that was never written down. This
  project has done that once already, which is why the leads table has no
  unique constraint and why the route refuses to claim success it cannot
  back up.
*/

const tmp = path.join(os.tmpdir(), `bx-api-lead-${process.pid}.db`);
process.env.BOOKINGS_DB_PATH = tmp;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.RESEND_API_KEY;

const { supabaseConfigured } = await import("../src/lib/store/supabase.ts");
assert.equal(supabaseConfigured, false, "must never run against the real database");

const { POST: lead } = await import("../src/app/api/lead/route.ts");
const { getStore } = await import("../src/lib/store/index.ts");

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(tmp + suffix, { force: true });
});

const enquiry = (over: Record<string, unknown> = {}) => ({
  name: "Mariam Saleh",
  phone: "010 8765 4321",
  email: "mariam@example.com",
  goal: "Personal Training",
  ...over,
});

const send = (body: unknown, options = {}) => lead(post("/api/lead", body, options));

describe("the enquiry form endpoint", () => {
  it("writes the enquiry down and says which one it is", async () => {
    const { status, body } = await read(await send(enquiry()));
    assert.equal(status, 200);
    assert.ok(body.id, "an id, so it can be found again");

    const saved = (await (await getStore()).listLeads()).find((l) => l.id === body.id);
    assert.equal(saved?.name, "Mariam Saleh");
    assert.equal(saved?.phone, "010 8765 4321");
    assert.equal(saved?.goal, "Personal Training");
    assert.equal(saved?.handledAt, null, "nobody has called them yet");
  });

  it("takes the same person twice, because asking twice is two enquiries", async () => {
    // Dropping the second because it resembles the first is the exact
    // failure the leads table exists to end.
    const first = await read(await send(enquiry()));
    const second = await read(await send(enquiry()));
    assert.equal(second.status, 200);
    assert.notEqual(first.body.id, second.body.id);
  });

  it("names every field that is missing, not just the first", async () => {
    const { status, body } = await read(await send({ name: "Only a name" }));
    assert.equal(status, 400);
    for (const field of ["phone", "email", "goal"]) {
      assert.match(String(body.error), new RegExp(field), `should name ${field}`);
    }
  });

  it("refuses an address that could never be written to", async () => {
    // Not strictness for its own sake: a bad address becomes a confirmation
    // the provider refuses, which lands in Problems as a failure nobody can
    // act on.
    for (const email of ["nope", "a@b", "@example.com", "a b@example.com", "a@@b.com", " "]) {
      const { status } = await read(await send(enquiry({ email })));
      assert.equal(status, 400, `should refuse ${JSON.stringify(email)}`);
    }
  });

  it("accepts the addresses real people have", async () => {
    for (const email of ["a.b+tag@sub.example.co.uk", "UPPER@EXAMPLE.COM", "x@y.io"]) {
      const { status } = await read(await send(enquiry({ email })));
      assert.equal(status, 200, `should accept ${email}`);
    }
  });

  it("cuts a very long field down rather than refusing the person", async () => {
    const { status, body } = await read(
      await send(enquiry({ name: "N".repeat(500), goal: "G".repeat(500) })),
    );
    assert.equal(status, 200);
    const saved = (await (await getStore()).listLeads()).find((l) => l.id === body.id)!;
    assert.equal(saved.name.length, 80);
    assert.equal(saved.goal.length, 120);
  });

  it("refuses a body that is not JSON", async () => {
    assert.equal((await read(await send("{nope"))).status, 400);
  });

  it("never says it was saved when it was not", async () => {
    const store = await getStore();
    const real = store.saveLead;
    store.saveLead = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    try {
      const { status, body } = await read(await send(enquiry()));
      assert.equal(status, 503, "503, not 500: the records are out of reach, not the site");
      assert.equal(body.ok, undefined);
      assert.match(String(body.error), /call us/i, "and it has to say what to do instead");
    } finally {
      store.saveLead = real;
    }
  });

  it("is not held up by the email that follows it", async () => {
    // The enquiry is saved; whoever filled the form in should not wait on an
    // email provider, and a slow one must not turn a good enquiry into an
    // error.
    const { notifyNewEnquiry } = await import("../src/lib/notify.ts");
    assert.equal(typeof notifyNewEnquiry, "function");

    const started = Date.now();
    const { status } = await read(await send(enquiry()));
    assert.equal(status, 200);
    assert.ok(Date.now() - started < 2000, "answered without waiting on email");
  });

  it("stops somebody hammering the form", async () => {
    const ip = { ip: "203.0.113.77" };
    let limited = false;
    for (let i = 0; i < 40; i += 1) {
      const { status } = await read(await send(enquiry(), ip));
      if (status === 429) {
        limited = true;
        break;
      }
    }
    assert.ok(limited, "the form has to be rate limited");
  });
});
