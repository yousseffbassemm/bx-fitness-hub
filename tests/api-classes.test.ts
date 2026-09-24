import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { get, post, read } from "./support/http.ts";

/*
  The booking endpoints, called the way Next calls them.

  These run against a throwaway SQLite file, so they exercise the real store
  and the real validation - only the framework's own per-request machinery
  is stubbed.
*/

const tmp = path.join(os.tmpdir(), `bx-api-classes-${process.pid}.db`);
process.env.BOOKINGS_DB_PATH = tmp;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { supabaseConfigured } = await import("../src/lib/store/supabase.ts");
assert.equal(supabaseConfigured, false, "must never run against the real database");

const { POST: book } = await import("../src/app/api/classes/book/route.ts");
const { POST: joinWaitlist } = await import("../src/app/api/classes/waitlist/route.ts");
const { POST: cancel } = await import("../src/app/api/classes/cancel/route.ts");
const { GET: availability } = await import("../src/app/api/classes/availability/route.ts");
const { POST: lookup } = await import("../src/app/api/members/lookup/route.ts");
const { getStore } = await import("../src/lib/store/index.ts");
const { capacityFor } = await import("../src/lib/booking.ts");

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(tmp + suffix, { force: true });
});

/** A Saturday far enough ahead to be inside the window whenever this runs. */
function nextSaturday(weeksAhead = 1) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7) + weeksAhead * 0);
  while (d.getTime() < Date.now() + 36 * 3600_000) d.setDate(d.getDate() + 7);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return iso;
}

const SAT = nextSaturday();
const CLASS = "0-200-mobility-flexibility"; // Saturday, 2:00 PM
const ORIENTAL = "0-700-oriental-flow"; // Saturday, 7:00 PM

let phone = 1000;
/** A guest: name, phone, and how they will pay. */
const someone = (over: Record<string, unknown> = {}) => ({
  sessionId: CLASS,
  date: SAT,
  name: "Test Guest",
  phone: `0100000${++phone}`,
  payment: "cash",
  ...over,
});

describe("POST /api/classes/book", () => {
  it("takes a booking and answers with the place and the link to it", async () => {
    const { status, body } = await read(await book(post("/api/classes/book", someone())));
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(typeof body.token, "string");
    assert.match(String(body.token), /^[a-f0-9]{16,64}$/);
    assert.equal(body.spotsLeft, capacityFor("Mobility & Flexibility") - 1);
  });

  it("refuses the same number on the same class", async () => {
    const twice = someone({ phone: "01099990001" });
    assert.equal((await read(await book(post("/api/classes/book", twice)))).status, 200);

    const { status, body } = await read(await book(post("/api/classes/book", twice)));
    assert.equal(status, 409);
    assert.equal(body.reason, "duplicate");
    assert.match(String(body.error), /already have a place/i);
  });

  it("will not take a name or a number that is not one", async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["no name", { name: "" }],
      ["one letter", { name: "A" }],
      ["a 300 character name", { name: "z".repeat(300) }],
      ["letters for a phone number", { phone: "not a phone" }],
      ["a very short number", { phone: "12" }],
      ["no payment method", { payment: undefined }],
      ["a payment method we do not take", { payment: "bitcoin" }],
      ["no session", { sessionId: "" }],
      ["a class that does not exist", { sessionId: "9-999-nope" }],
    ];
    for (const [label, over] of cases) {
      const { status } = await read(await book(post("/api/classes/book", someone(over))));
      assert.ok(status >= 400 && status < 500, `${label} should be refused, got ${status}`);
    }
  });

  it("will not take a date that is not this class's day, or is gone, or is made up", async () => {
    for (const [label, date] of [
      ["yesterday", "2020-01-01"],
      ["a Sunday for a Saturday class", "2026-09-27"],
      ["31 February", "2026-02-31"],
      ["a word", "tomorrow"],
      ["far beyond the window", "2030-01-05"],
    ] as const) {
      const { status } = await read(await book(post("/api/classes/book", someone({ date }))));
      assert.ok(status >= 400 && status < 500, `${label} should be refused, got ${status}`);
    }
  });

  it("refuses a body that is not JSON at all", async () => {
    const { status } = await read(await book(post("/api/classes/book", "not json")));
    assert.equal(status, 400);
  });

  it("stops a caller who is hammering it, and says to wait", async () => {
    const ip = "198.51.100.7";
    let last = await read(await book(post("/api/classes/book", someone(), { ip })));
    for (let i = 0; i < 60 && last.status !== 429; i++) {
      last = await read(await book(post("/api/classes/book", someone(), { ip })));
    }
    assert.equal(last.status, 429);
    assert.match(String(last.body.error), /wait/i);
  });
});

describe("a class that has already begun", () => {
  /*
    Written against a timetable this test owns rather than against the clock.
    The first version looked for a class earlier today and gave up when there
    was not one, which meant it asserted nothing at all for most of the day -
    and passed happily with the check taken back out.

    A class at midnight on today's own row has always started, whenever this
    runs.
  */
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const rowForToday = [6, 0, 1, 2, 3, 4, 5].indexOf(today.getDay());

  before(async () => {
    const week = Array.from({ length: 7 }, (_, i) => ({
      day: String(i),
      short: String(i),
      sessions:
        i === rowForToday
          ? [
              { id: "midnight-class", time: "12:00 AM", coach: "Nobody", discipline: "Long Over" },
              { id: "last-thing-tonight", time: "11:59 PM", coach: "Nobody", discipline: "Still To Come" },
            ]
          : [],
    }));
    await (await getStore()).setContent("schedule", week, "tests");
  });

  after(async () => {
    await (await getStore()).setContent("schedule", [], "tests");
  });

  it("will not take a booking for it", async () => {
    const { status, body } = await read(
      await book(post("/api/classes/book", someone({ sessionId: "midnight-class", date: iso }))),
    );
    assert.equal(status, 409);
    assert.equal(body.reason, "started");
    assert.match(String(body.error), /already started/i);
  });

  it("will not put anyone on its waitlist either", async () => {
    const { status, body } = await read(
      await joinWaitlist(post("/api/classes/waitlist", { sessionId: "midnight-class", date: iso, name: "Too Late", phone: "01066660001", payment: "cash" })),
    );
    assert.equal(status, 409);
    assert.equal(body.reason, "started");
  });

  it("still takes a booking for one later the same day", async () => {
    const { status } = await read(
      await book(post("/api/classes/book", someone({ sessionId: "last-thing-tonight", date: iso }))),
    );
    assert.equal(status, 200, "only classes that have begun are closed, not the whole day");
  });
});

describe("booking as a member", () => {
  /*
    The membership is checked against the database, not against what the
    browser says it is. "I am a member" in a request body is a claim, and the
    desk would be the one to find out it was wrong.
  */
  const STRONGER = "0-600-60-min-stronger";
  let memberId = "";

  before(async () => {
    const added = await (await getStore()).addMember({
      memberNo: "BX-7001",
      name: "Karma Wael",
      phone: "01055550001",
    });
    memberId = added.ok ? added.member.id : "";
  });

  it("finds a membership by number or phone, and says only the first name", async () => {
    for (const reference of ["BX-7001", "01055550001"]) {
      const { status, body } = await read(await lookup(post("/api/members/lookup", { reference })));
      assert.equal(status, 200);
      assert.equal(body.found, true);
      assert.equal(body.firstName, "Karma");
      // Nothing else: this endpoint is public, and a surname, a phone or a
      // membership number would all be worth harvesting.
      assert.deepEqual(Object.keys(body).sort(), ["firstName", "found"]);
    }
  });

  it("says it cannot find one rather than hinting", async () => {
    const { body } = await read(await lookup(post("/api/members/lookup", { reference: "BX-9999" })));
    assert.equal(body.found, false);
    assert.equal(body.reason, "unknown");
  });

  it("refuses a lookup with nothing in it", async () => {
    assert.equal((await read(await lookup(post("/api/members/lookup", { reference: "" })))).status, 400);
    assert.equal(
      (await read(await lookup(post("/api/members/lookup", { reference: "z".repeat(200) })))).status,
      400,
    );
  });

  it("books them under the membership, with nothing to pay", async () => {
    const { status } = await read(
      await book(post("/api/classes/book", { sessionId: STRONGER, date: SAT, member: true, memberRef: "BX-7001" })),
    );
    assert.equal(status, 200);

    const rows = await (await getStore()).list(SAT, SAT);
    const mine = rows.find((r) => r.memberId === memberId);
    assert.ok(mine, "the booking should carry the membership");
    assert.equal(mine.name, "Karma Wael", "the name comes from the membership, not the browser");
    assert.equal(mine.payment, null);
  });

  it("will not take a membership it cannot find", async () => {
    const { status, body } = await read(
      await book(post("/api/classes/book", { sessionId: STRONGER, date: SAT, member: true, memberRef: "BX-0000" })),
    );
    assert.equal(status, 404);
    assert.equal(body.reason, "unknown-member");
  });

  it("will not take the claim without the proof", async () => {
    // "member: true" and nothing else is not a membership.
    const { status } = await read(
      await book(post("/api/classes/book", { sessionId: STRONGER, date: SAT, member: true })),
    );
    assert.equal(status, 400);
  });

  it("ignores a name and phone sent alongside a membership", async () => {
    const store = await getStore();
    await store.addMember({ memberNo: "BX-7002", name: "Real Name", phone: "01055550002" });

    await read(
      await book(
        post("/api/classes/book", {
          sessionId: STRONGER,
          date: SAT,
          member: true,
          memberRef: "BX-7002",
          name: "Someone Else Entirely",
          phone: "01099999999",
        }),
      ),
    );

    const rows = await store.list(SAT, SAT);
    assert.ok(rows.some((r) => r.name === "Real Name"));
    assert.ok(!rows.some((r) => r.name === "Someone Else Entirely"), "the browser does not get to name them");
  });

  it("asks for the number when one phone has two memberships", async () => {
    const store = await getStore();
    await store.addMember({ memberNo: "BX-7003", name: "Partner One", phone: "01055550003" });
    await store.addMember({ memberNo: "BX-7004", name: "Partner Two", phone: "01055550003" });

    const { status, body } = await read(
      await book(post("/api/classes/book", { sessionId: STRONGER, date: SAT, member: true, memberRef: "01055550003" })),
    );
    assert.equal(status, 409);
    assert.equal(body.reason, "ambiguous-member");
    assert.match(String(body.error), /membership number/i);
  });

  it("will not let a lapsed membership book as a member", async () => {
    const store = await getStore();
    const lapsed = await store.addMember({ memberNo: "BX-7005", name: "Gone Away", phone: "01055550005" });
    assert.ok(lapsed.ok);
    await store.setMemberEnded(lapsed.member.id, true);

    const { status, body } = await read(
      await book(post("/api/classes/book", { sessionId: STRONGER, date: SAT, member: true, memberRef: "BX-7005" })),
    );
    assert.equal(status, 404);
    assert.equal(body.reason, "unknown-member");
  });
});

describe("POST /api/classes/waitlist", () => {
  it("refuses to queue anyone for a class with room in it", async () => {
    // Nothing would ever move them along: promotion only happens when a
    // place is given up, so they would wait for a class they could walk into.
    const { status, body } = await read(
      await joinWaitlist(post("/api/classes/waitlist", { sessionId: ORIENTAL, date: SAT, name: "Hopeful", phone: "01088880001", payment: "cash" })),
    );
    assert.equal(status, 409);
    assert.equal(body.reason, "not-full");
    assert.match(String(body.error), /still room/i);
  });

  it("takes people once the class is full, and refuses a second try", async () => {
    const capacity = capacityFor("Oriental Flow");
    const store = await getStore();
    for (let i = 0; i < capacity; i++) {
      await store.book({ sessionId: ORIENTAL, date: SAT, name: `Filler ${i}`, phone: `0107777${String(i).padStart(4, "0")}`, capacity });
    }

    const join = (phone: string) =>
      joinWaitlist(post("/api/classes/waitlist", { sessionId: ORIENTAL, date: SAT, name: "Hopeful", phone, payment: "cash" }));

    assert.equal((await read(await join("01088880002"))).status, 200);
    const again = await read(await join("01088880002"));
    assert.equal(again.status, 409);
    assert.match(String(again.body.error), /already on the list/i);
  });
});

describe("POST /api/classes/cancel", () => {
  it("gives the place up and hands it to whoever is waiting", async () => {
    const capacity = capacityFor("Oriental Flow");
    const store = await getStore();
    const rows = await store.list(SAT, SAT);
    const giving = rows.find((r) => r.sessionId === ORIENTAL && r.name === "Filler 0");
    assert.ok(giving?.token);

    const { status, body } = await read(await cancel(post("/api/classes/cancel", { token: giving.token })));
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.promoted, true, "somebody was waiting, so the place should not go begging");

    const taken = (await store.counts(SAT, SAT))[`${ORIENTAL}|${SAT}`];
    assert.equal(taken, capacity, "one out, one in");
  });

  it("refuses a token that is not one, and one that is not ours", async () => {
    for (const token of ["", "nope", "../../etc/passwd", "f".repeat(32)]) {
      const { status } = await read(await cancel(post("/api/classes/cancel", { token })));
      assert.ok(status >= 400, `should refuse ${JSON.stringify(token)}`);
    }
  });
});

describe("GET /api/classes/availability", () => {
  it("answers with what is taken and what each class holds", async () => {
    const { status, body } = await read(await availability(get(`/api/classes/availability?from=${SAT}&to=${SAT}`)));
    assert.equal(status, 200);
    assert.equal(typeof body.capacity, "object");
    assert.equal(typeof body.taken, "object");
    const capacity = body.capacity as Record<string, number>;
    assert.ok(capacity[CLASS] > 0, "every class should report a capacity");
  });

  it("refuses a range that is not a pair of dates", async () => {
    for (const q of ["", "?from=nope&to=nope", `?from=${SAT}`, "?from=2026-13-40&to=2026-13-41"]) {
      const { status } = await read(await availability(get(`/api/classes/availability${q}`)));
      assert.ok(status >= 400, `should refuse ${JSON.stringify(q)}`);
    }
  });
});

describe("when the database cannot be reached", () => {
  /*
    Every way into a class now asks the database who this person is before
    it does anything else, and that question was being asked outside the
    handler's try block. A store that was down threw straight past it, so
    Next answered a bare 500 with an empty body: somebody part way through
    booking got a dead form and no reason for it.
  */
  it("says so on every way in, rather than failing blank", async () => {
    const store = await getStore();
    const real = store.findMember;
    store.findMember = async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
    };

    try {
      const attempts: Array<[string, Response]> = [
        [
          "booking as a member",
          await book(
            post("/api/classes/book", {
              sessionId: CLASS,
              date: SAT,
              member: true,
              memberRef: "BX-0142",
            }),
          ),
        ],
        ["booking as a guest", await book(post("/api/classes/book", someone()))],
        [
          "joining the queue",
          await joinWaitlist(post("/api/classes/waitlist", someone())),
        ],
      ];

      for (const [how, response] of attempts) {
        const { status, body } = await read(response);
        assert.equal(status, 503, `${how} should answer "unavailable", not crash`);
        assert.match(
          String(body.error ?? ""),
          /call us|give us a call/i,
          `${how} needs to tell them what to do instead`,
        );
      }
    } finally {
      store.findMember = real;
    }
  });
});
