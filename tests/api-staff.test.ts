import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { read, send, SITE } from "./support/http.ts";

/*
  The staff endpoints. src/proxy.ts guards the /staff pages, but not
  /api/staff/* - the login route has to stay reachable - so each of these
  checks for itself, and that check is most of what is tested here.
*/

const tmp = path.join(os.tmpdir(), `bx-api-staff-${process.pid}.db`);
process.env.BOOKINGS_DB_PATH = tmp;
process.env.STAFF_SESSION_SECRET = "a-test-secret-long-enough-to-be-accepted-0123456789";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { supabaseConfigured } = await import("../src/lib/store/supabase.ts");
assert.equal(supabaseConfigured, false, "must never run against the real database");

const { PUT: saveContent } = await import("../src/app/api/staff/content/route.ts");
const { POST: addUser, PATCH: setRole, DELETE: removeUser } = await import("../src/app/api/staff/users/route.ts");
const { revalidated } = await import("./support/stubs/next-cache.ts");
const { createSessionToken, STAFF_COOKIE } = await import("../src/lib/staff/session.ts");
const { getStore } = await import("../src/lib/store/index.ts");
const { defaultCoachValues, defaultFacilityValues, defaultGalleryValues } = await import("../src/lib/content.ts");

let adminCookie = "";
let floorCookie = "";

before(async () => {
  const store = await getStore();
  await store.upsertStaffUser("boss", "irrelevant-hash", "admin");
  await store.upsertStaffUser("floor", "irrelevant-hash", "staff");
  adminCookie = `${STAFF_COOKIE}=${await createSessionToken("boss")}`;
  floorCookie = `${STAFF_COOKIE}=${await createSessionToken("floor")}`;
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(tmp + suffix, { force: true });
});

const asAdmin = (over = {}) => ({ cookie: adminCookie, origin: SITE, ...over });

describe("who is let in", () => {
  const payload = { key: "plans", value: [{ name: "Monthly", price: "[X]", period: "per month", blurb: "" }] };

  it("turns away anyone without a session", async () => {
    const { status } = await read(await saveContent(send("PUT", "/api/staff/content", payload)));
    assert.equal(status, 401);
  });

  it("turns away a forged or expired session", async () => {
    for (const token of ["nonsense", "boss.9999999999.notasignature", `boss.${Math.floor(Date.now() / 1000) - 10}.x`]) {
      const { status } = await read(
        await saveContent(send("PUT", "/api/staff/content", payload, { cookie: `${STAFF_COOKIE}=${token}` })),
      );
      assert.equal(status, 401, `should refuse ${token}`);
    }
  });

  it("turns away a valid session for an account that has been removed", async () => {
    // The Edge gate has no database and cannot know. This is the first place
    // that can ask, and without it a removed colleague keeps their access
    // for the rest of the ten hours.
    const store = await getStore();
    await store.upsertStaffUser("ghost", "hash", "admin");
    const cookie = `${STAFF_COOKIE}=${await createSessionToken("ghost")}`;
    await store.deleteStaffUser("ghost");

    const { status, body } = await read(await saveContent(send("PUT", "/api/staff/content", payload, { cookie })));
    assert.equal(status, 401);
    assert.match(String(body.error), /gone/i);
  });

  it("turns away a request claiming a different origin", async () => {
    // Belt and braces on top of the sameSite cookie.
    const { status, body } = await read(
      await saveContent(send("PUT", "/api/staff/content", payload, { cookie: adminCookie, origin: "https://evil.test" })),
    );
    assert.equal(status, 403);
    assert.match(String(body.error), /origin/i);
  });

  it("keeps floor staff out of the things only an admin may change", async () => {
    const { status, body } = await read(
      await saveContent(send("PUT", "/api/staff/content", payload, { cookie: floorCookie, origin: SITE })),
    );
    assert.equal(status, 403);
    assert.match(String(body.error), /admin/i);
  });
});

describe("PUT /api/staff/content", () => {
  it("saves a price and tells Next the page is stale", async () => {
    revalidated.length = 0;
    const { status } = await read(
      await saveContent(
        send("PUT", "/api/staff/content", {
          key: "plans",
          value: [{ name: "Monthly", price: "[NEW]", period: "per month", blurb: "Full access." }],
        }, asAdmin()),
      ),
    );
    assert.equal(status, 200);
    assert.deepEqual(await (await getStore()).getContent("plans"), [
      { name: "Monthly", price: "[NEW]", period: "per month", blurb: "Full access." },
    ]);
    // The marketing page is prerendered; without this a new price would not
    // show until the next deploy.
    assert.ok(revalidated.includes("/"), "a save has to revalidate the home page");
  });

  it("will not save a plan with no price or no period", async () => {
    for (const over of [{ price: "" }, { period: "  " }]) {
      const { status, body } = await read(
        await saveContent(
          send("PUT", "/api/staff/content", {
            key: "plans",
            value: [{ name: "Monthly", price: "[X]", period: "per month", blurb: "", ...over }],
          }, asAdmin()),
        ),
      );
      assert.equal(status, 400);
      assert.match(String(body.error), /price and a period/i);
    }
  });

  it("lets staff rename a coach they have a photograph for", async () => {
    // The bug this endpoint used to have: the name was the identity, so
    // correcting a spelling was read as adding somebody with no photo.
    const coaches = defaultCoachValues();
    const { status } = await read(
      await saveContent(
        send("PUT", "/api/staff/content", {
          key: "coaches",
          value: [{ ...coaches[0], name: "Ahmed Ayman Hassan" }, ...coaches.slice(1)],
        }, asAdmin()),
      ),
    );
    assert.equal(status, 200);
  });

  it("still insists a genuinely new coach brings a photograph", async () => {
    const { status, body } = await read(
      await saveContent(
        send("PUT", "/api/staff/content", {
          key: "coaches",
          value: [{ base: null, name: "Brand New", credential: "CPT", disciplines: [], photoId: null, focus: "center top" }],
        }, asAdmin()),
      ),
    );
    assert.equal(status, 400);
    assert.match(String(body.error), /photo/i);
  });

  it("lets staff retitle a facility and re-describe a photo", async () => {
    const facilities = defaultFacilityValues();
    const first = await read(
      await saveContent(
        send("PUT", "/api/staff/content", {
          key: "facilities",
          value: [{ ...facilities[0], title: "The Weights Room" }, ...facilities.slice(1)],
        }, asAdmin()),
      ),
    );
    assert.equal(first.status, 200);

    const gallery = defaultGalleryValues();
    const second = await read(
      await saveContent(
        send("PUT", "/api/staff/content", {
          key: "gallery",
          value: [{ ...gallery[0], alt: "A better description of this photo" }, ...gallery.slice(1)],
        }, asAdmin()),
      ),
    );
    assert.equal(second.status, 200);
  });

  it("will not empty a section that would look broken", async () => {
    for (const key of ["coaches", "facilities", "gallery"]) {
      const { status } = await read(
        await saveContent(send("PUT", "/api/staff/content", { key, value: [] }, asAdmin())),
      );
      assert.equal(status, 400, `${key} should refuse an empty list`);
    }
  });

  it("insists the timetable is seven days and every class has a time and a name", async () => {
    const week = Array.from({ length: 7 }, () => ({ sessions: [] }));
    assert.equal(
      (await read(await saveContent(send("PUT", "/api/staff/content", { key: "schedule", value: week.slice(0, 6) }, asAdmin())))).status,
      400,
    );
    const nameless = week.map((d, i) => (i === 0 ? { sessions: [{ time: "7:00 PM", discipline: "" }] } : d));
    assert.equal(
      (await read(await saveContent(send("PUT", "/api/staff/content", { key: "schedule", value: nameless }, asAdmin())))).status,
      400,
    );
  });

  it("refuses a section it does not know, and a value that is not a list", async () => {
    assert.equal((await read(await saveContent(send("PUT", "/api/staff/content", { key: "nope", value: [] }, asAdmin())))).status, 400);
    assert.equal((await read(await saveContent(send("PUT", "/api/staff/content", { key: "plans", value: { a: 1 } }, asAdmin())))).status, 400);
  });
});

describe("the team list", () => {
  it("adds an account, changes its role and removes it", async () => {
    const add = await read(
      await addUser(send("POST", "/api/staff/users", { username: "newdesk", password: "a-long-enough-password", role: "staff" }, asAdmin())),
    );
    assert.equal(add.status, 200);
    assert.equal(add.body.role, "staff");

    assert.equal((await read(await setRole(send("PATCH", "/api/staff/users", { username: "newdesk", role: "admin" }, asAdmin())))).status, 200);
    assert.equal((await (await getStore()).findStaffUser("newdesk"))?.role, "admin");

    assert.equal((await read(await removeUser(send("DELETE", "/api/staff/users", { username: "newdesk" }, asAdmin())))).status, 200);
    assert.equal(await (await getStore()).findStaffUser("newdesk"), null);
  });

  it("refuses a username or password that would not do", async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["empty username", { username: "", password: "a-long-enough-password" }],
      ["spaces in it", { username: "two words", password: "a-long-enough-password" }],
      ["too long", { username: "z".repeat(40), password: "a-long-enough-password" }],
      ["a short password", { username: "shorty", password: "abc" }],
    ];
    for (const [label, body] of cases) {
      const { status } = await read(await addUser(send("POST", "/api/staff/users", { role: "staff", ...body }, asAdmin())));
      assert.equal(status, 400, `${label} should be refused`);
    }
  });

  it("refuses a username that is already taken", async () => {
    const { status, body } = await read(
      await addUser(send("POST", "/api/staff/users", { username: "boss", password: "a-long-enough-password", role: "staff" }, asAdmin())),
    );
    assert.equal(status, 409);
    assert.match(String(body.error), /already exists/i);
  });

  it("will not let an admin lock themselves out", async () => {
    /*
      With a second admin in place, so it is the self check being tested and
      not the one below it. Both answer 409, and the first version of this
      test could not tell them apart - it passed with the self check taken
      out, because "that is the only admin left" caught the same call.
    */
    const store = await getStore();
    await store.upsertStaffUser("deputy", "hash", "admin");
    try {
      const removed = await read(await removeUser(send("DELETE", "/api/staff/users", { username: "boss" }, asAdmin())));
      assert.equal(removed.status, 409);
      assert.match(String(removed.body.error), /your own account/i);

      const demoted = await read(await setRole(send("PATCH", "/api/staff/users", { username: "boss", role: "staff" }, asAdmin())));
      assert.equal(demoted.status, 409);
      assert.match(String(demoted.body.error), /your own admin/i);

      assert.equal((await store.findStaffUser("boss"))?.role, "admin");

      // And the difference: somebody else's account is fine to remove.
      assert.equal(
        (await read(await removeUser(send("DELETE", "/api/staff/users", { username: "deputy" }, asAdmin())))).status,
        200,
      );
    } finally {
      await store.deleteStaffUser("deputy");
    }
  });

  it("will not leave the gym with no admin at all", async () => {
    // Reachable only through the role change: an admin demoting the last
    // admin who is not themselves.
    const store = await getStore();
    const { status, body } = await read(
      await setRole(send("PATCH", "/api/staff/users", { username: "boss", role: "staff" }, asAdmin())),
    );
    assert.equal(status, 409);
    assert.ok(/own admin|only admin/i.test(String(body.error)));
    assert.equal((await store.listStaffUsers()).filter((u) => u.role === "admin").length >= 1, true);
  });

  it("says so plainly for an account that is not there", async () => {
    assert.equal((await read(await removeUser(send("DELETE", "/api/staff/users", { username: "nobody" }, asAdmin())))).status, 404);
    assert.equal((await read(await setRole(send("PATCH", "/api/staff/users", { username: "nobody", role: "admin" }, asAdmin())))).status, 404);
  });

  it("keeps floor staff out of the team list entirely", async () => {
    const options = { cookie: floorCookie, origin: SITE };
    for (const [label, call] of [
      ["add", () => addUser(send("POST", "/api/staff/users", { username: "x", password: "a-long-enough-password" }, options))],
      ["role", () => setRole(send("PATCH", "/api/staff/users", { username: "floor", role: "admin" }, options))],
      ["remove", () => removeUser(send("DELETE", "/api/staff/users", { username: "boss" }, options))],
    ] as const) {
      assert.equal((await read(await call())).status, 403, `${label} should be admin only`);
    }
  });
});
