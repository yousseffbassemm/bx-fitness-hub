import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { slotKey } from "../src/lib/booking.ts";
import type { BookingStore } from "../src/lib/store/types.ts";

/*
  One specification, run against every store the site can be pointed at.

  The stores are interchangeable by design - Supabase in production, SQLite
  on a laptop, memory as a last resort - and the thing that has actually gone
  wrong on this project is them drifting apart: a command wrote to SQLite
  while the site read Supabase, reported success, and the login failed. A
  single suite run against each one is what catches that.

  Supabase is not included: it is a network service and these tests must run
  with nothing switched on.
*/

const SESSION = "0-200-mobility-flexibility";
const DATE = "2026-09-26";
const NEXT = "2026-09-27";
const CAPACITY = 3;

const taken = async (store: BookingStore, date = DATE) =>
  (await store.counts(date, date))[slotKey(SESSION, date)] ?? 0;

const someone = (name: string, phone: string, date = DATE) => ({
  sessionId: SESSION,
  date,
  name,
  phone,
  capacity: CAPACITY,
});

function contract(label: string, open: () => Promise<BookingStore>) {
  describe(label, () => {
    let store: BookingStore;
    before(async () => {
      store = await open();
    });

    it("takes a booking and gives the member a token for it", async () => {
      const result = await store.book(someone("Amina", "01000000001"));
      assert.equal(result.ok, true);
      assert.ok(result.ok && result.token, "a booking without a token cannot be found again");
      assert.match(result.ok ? result.token! : "", /^[a-f0-9]{16,64}$/);

      const found = await store.getByToken(result.ok ? result.token! : "");
      assert.ok(found, "the token should lead back to the booking");
      assert.equal(found.name, "Amina");
      assert.equal(found.cancelledAt, null);
    });

    it("counts a place as taken the moment it is booked", async () => {
      assert.equal(await taken(store), 1);
    });

    it("refuses the same phone number twice for one class", async () => {
      const again = await store.book(someone("Amina Again", "01000000001"));
      assert.equal(again.ok, false);
      assert.equal(again.ok === false ? again.reason : null, "duplicate");
      assert.equal(await taken(store), 1, "a refusal must not take a place");
    });

    it("lets the same number book a different day", async () => {
      const other = await store.book(someone("Amina", "01000000001", NEXT));
      assert.equal(other.ok, true);
    });

    it("fills up at capacity and not one more", async () => {
      assert.equal((await store.book(someone("Basma", "01000000002"))).ok, true);
      assert.equal((await store.book(someone("Carla", "01000000003"))).ok, true);
      assert.equal(await taken(store), CAPACITY);

      const overflow = await store.book(someone("Dalia", "01000000004"));
      assert.equal(overflow.ok, false);
      assert.equal(overflow.ok === false ? overflow.reason : null, "full");
      assert.equal(await taken(store), CAPACITY, "a full class must not go over");
    });

    it("never oversells when everyone books at once", async () => {
      // The race the gym would actually hit: one place left, several phones.
      const date = "2026-10-03";
      await store.book({ ...someone("First", "01000001001", date), capacity: 2 });
      const rush = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          store.book({ ...someone(`Rush ${i}`, `0100000200${i}`, date), capacity: 2 }),
        ),
      );
      assert.equal(rush.filter((r) => r.ok).length, 1, "exactly one should get in");
      assert.equal(await taken(store, date), 2);
    });

    it("frees the place when a booking is cancelled, and keeps the record", async () => {
      const rows = await store.list(DATE, DATE);
      const basma = rows.find((r) => r.name === "Basma");
      assert.ok(basma);

      const cancelled = await store.cancel(basma.id);
      assert.equal(cancelled.ok, true);
      assert.equal(await taken(store), CAPACITY - 1);

      const still = await store.get(basma.id);
      assert.ok(still, "cancelling must not delete the record");
      assert.notEqual(still.cancelledAt, null);
    });

    it("says so rather than throwing when a booking is not there", async () => {
      assert.equal(await store.get("does-not-exist"), null);
      assert.equal(await store.getByToken("f".repeat(32)), null);
      assert.equal((await store.cancel("does-not-exist")).ok, false);
    });

    describe("the waitlist", () => {
      const FULL = "2026-10-10";

      before(async () => {
        for (let i = 0; i < CAPACITY; i++) {
          await store.book(someone(`Filler ${i}`, `0100000300${i}`, FULL));
        }
        assert.equal(await taken(store, FULL), CAPACITY);
      });

      it("takes people in the order they ask", async () => {
        const first = await store.joinWaitlist({ sessionId: SESSION, date: FULL, name: "Waiting One", phone: "01000004001" });
        const second = await store.joinWaitlist({ sessionId: SESSION, date: FULL, name: "Waiting Two", phone: "01000004002" });
        assert.deepEqual([first, second], [{ ok: true, position: 1 }, { ok: true, position: 2 }]);
      });

      it("refuses the same number twice", async () => {
        const again = await store.joinWaitlist({ sessionId: SESSION, date: FULL, name: "Waiting One", phone: "01000004001" });
        assert.equal(again.ok, false);
      });

      it("promotes the longest waiting, and only them", async () => {
        const rows = await store.list(FULL, FULL);
        await store.cancel(rows.find((r) => r.name === "Filler 0")!.id);

        const promoted = await store.promoteFromWaitlist(SESSION, FULL, CAPACITY);
        assert.ok(promoted, "somebody was waiting, so somebody should come off the list");
        assert.equal(promoted.name, "Waiting One", "first in the queue, not the second");
        assert.ok(promoted.token, "a promoted member needs a link to their place too");
        assert.equal(await taken(store, FULL), CAPACITY, "one out, one in");

        const waiting = await store.listWaitlist(FULL, FULL);
        assert.equal(waiting.find((w) => w.name === "Waiting One")?.promotedAt !== null, true);
        assert.equal(waiting.find((w) => w.name === "Waiting Two")?.promotedAt, null);
      });

      it("promotes nobody into a class that is still full", async () => {
        assert.equal(await store.promoteFromWaitlist(SESSION, FULL, CAPACITY), null);
      });

      it("lists a promoted member until somebody says they were told", async () => {
        const promoted = await store.listPromoted(FULL, FULL);
        assert.equal(promoted.length, 1);
        await store.markTold(promoted[0].id);
        assert.equal((await store.listPromoted(FULL, FULL)).length, 0);
      });
    });

    describe("enquiries", () => {
      it("saves one and lists it", async () => {
        const saved = await store.saveLead({
          name: "Hana",
          phone: "01000005001",
          email: "hana@example.com",
          goal: "Build Muscle",
        });
        assert.equal(saved.ok, true);

        const leads = await store.listLeads();
        const hana = leads.find((l) => l.name === "Hana");
        assert.ok(hana);
        assert.equal(hana.handledAt, null);

        await store.setLeadHandled(hana.id, true);
        assert.notEqual((await store.listLeads()).find((l) => l.name === "Hana")?.handledAt, null);
        await store.setLeadHandled(hana.id, false);
        assert.equal((await store.listLeads()).find((l) => l.name === "Hana")?.handledAt, null);
      });
    });

    describe("staff accounts", () => {
      it("creates, finds, re-roles and removes one", async () => {
        await store.upsertStaffUser("tilly", "hash-one", "staff");
        const found = await store.findStaffUser("tilly");
        assert.ok(found);
        assert.equal(found.role, "staff");
        assert.equal(found.passwordHash, "hash-one");

        assert.equal(await store.setStaffRole("tilly", "admin"), true);
        assert.equal((await store.findStaffUser("tilly"))?.role, "admin");

        // Same username again is a password reset, not a second account.
        await store.upsertStaffUser("tilly", "hash-two");
        assert.equal((await store.findStaffUser("tilly"))?.passwordHash, "hash-two");
        assert.equal((await store.listStaffUsers()).filter((u) => u.username === "tilly").length, 1);

        assert.equal(await store.deleteStaffUser("tilly"), true);
        assert.equal(await store.findStaffUser("tilly"), null);
        assert.equal(await store.deleteStaffUser("tilly"), false, "removing twice is not an error");
      });

      it("says no rather than throwing for an account that is not there", async () => {
        assert.equal(await store.findStaffUser("nobody"), null);
        assert.equal(await store.setStaffRole("nobody", "admin"), false);
      });
    });

    describe("saved content", () => {
      it("keeps the last thing written under a key", async () => {
        await store.setContent("plans", [{ name: "Monthly", price: "[X]" }], "tester");
        assert.deepEqual(await store.getContent("plans"), [{ name: "Monthly", price: "[X]" }]);

        await store.setContent("plans", [{ name: "Monthly", price: "[Y]" }], "tester");
        assert.deepEqual(await store.getContent("plans"), [{ name: "Monthly", price: "[Y]" }]);
        assert.equal(await store.getContent("never-written"), null);
      });
    });

    describe("problems", () => {
      it("counts the same failure once, with a tally", async () => {
        await store.recordError("POST /api/lead", "fetch failed", "stack");
        await store.recordError("POST /api/lead", "fetch failed", "stack");
        const errors = await store.listErrors();
        const row = errors.find((e) => e.where === "POST /api/lead");
        assert.ok(row);
        assert.equal(row.count, 2, "the same failure twice is one row that happened twice");
      });
    });
  });
}

contract("the memory store", async () => {
  const { memoryStore } = await import("../src/lib/store/memory.ts");
  return memoryStore;
});

const tmp = path.join(os.tmpdir(), `bx-store-test-${process.pid}.db`);
contract("the sqlite store", async () => {
  process.env.BOOKINGS_DB_PATH = tmp;
  const { sqliteStore } = await import("../src/lib/store/sqlite.ts");
  return sqliteStore;
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(tmp + suffix, { force: true });
});
