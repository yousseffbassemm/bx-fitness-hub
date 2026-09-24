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

/*
  A guest, in the shape the booking route always builds: name, phone, and
  how they will pay. The payment is what marks a booking as made by a guest
  rather than by a member - see the guest uniqueness rule in the stores -
  so a test that leaves it out is not testing a booking this site can make.
*/
const someone = (name: string, phone: string, date = DATE) => ({
  sessionId: SESSION,
  date,
  name,
  phone,
  capacity: CAPACITY,
  payment: "cash" as const,
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

    describe("members", () => {
      /*
        The membership list is what tells a booking apart at the desk: a
        member's place is part of what they already pay for, a guest pays
        for the class.
      */
      let karma = "";

      it("adds one and finds it by its number or by phone", async () => {
        const added = await store.addMember({
          memberNo: "BX-0142",
          name: "Karma Wael",
          phone: "01000000900",
        });
        assert.equal(added.ok, true);
        karma = added.ok ? added.member.id : "";

        for (const reference of ["BX-0142", "bx-0142", "  BX-0142  ", "01000000900"]) {
          const found = await store.findMember(reference);
          assert.equal(found.found, true, `should find by ${JSON.stringify(reference)}`);
          assert.equal(found.found && found.member.name, "Karma Wael");
        }
      });

      it("treats the reference as a value, never as a pattern", async () => {
        /*
          The hole this was written for. Matching the number
          case-insensitively means ilike over PostgREST, and ilike is a
          pattern: "*" was translated to "%" before it reached Postgres, so
          a single asterisk typed into the booking form matched the first
          membership in the table and took a free place under that person's
          name. "A*", "B*" walked the list.

          Every store is asked, because only one of them had it - which is
          the whole reason this suite runs against them all.
        */
        for (const pattern of ["*", "%", "_", "BX*", "B%", "BX-014%", "BX-014_", "%%", "\\"]) {
          const found = await store.findMember(pattern);
          assert.equal(found.found, false, `${JSON.stringify(pattern)} must not match anybody`);
        }
      });

      it("does not invent a membership that is not there", async () => {
        for (const reference of ["", "  ", "BX-9999", "01000000999"]) {
          const found = await store.findMember(reference);
          assert.equal(found.found, false, `should not find ${JSON.stringify(reference)}`);
        }
      });

      it("refuses a second membership on the same number", async () => {
        const again = await store.addMember({
          memberNo: "bx-0142",
          name: "Someone Else",
          phone: "01000000901",
        });
        assert.equal(again.ok, false);
      });

      it("asks for the number when one phone has two memberships", async () => {
        // BX sells a Couples & Friends plan, so two people on one number is
        // a thing they sell. Picking one would book the wrong person in.
        const second = await store.addMember({
          memberNo: "BX-0143",
          name: "Their Partner",
          phone: "01000000900",
        });
        assert.equal(second.ok, true);

        const byPhone = await store.findMember("01000000900");
        assert.equal(byPhone.found, false);
        assert.equal(byPhone.found === false && byPhone.reason, "ambiguous");

        // Each number still finds its own.
        assert.equal((await store.findMember("BX-0143")).found, true);
      });

      it("stops finding somebody once they lapse, and starts again when reinstated", async () => {
        assert.equal(await store.setMemberEnded(karma, true), true);
        assert.equal((await store.findMember("BX-0142")).found, false);

        assert.equal(await store.setMemberEnded(karma, false), true);
        assert.equal((await store.findMember("BX-0142")).found, true);
      });

      it("keeps a correction", async () => {
        const changed = await store.updateMember(karma, {
          memberNo: "BX-0142",
          name: "Karma W",
          phone: "01000000902",
        });
        assert.equal(changed.ok, true);
        const found = await store.findMember("01000000902");
        assert.equal(found.found && found.member.name, "Karma W");
      });

      it("will not correct one number into another's", async () => {
        const clash = await store.updateMember(karma, {
          memberNo: "BX-0143",
          name: "Karma W",
          phone: "01000000902",
        });
        assert.equal(clash.ok, false);
        assert.equal(clash.ok === false && clash.reason, "duplicate-number");
      });

      it("marks a booking as theirs, and says so on the class list", async () => {
        const result = await store.book({
          sessionId: SESSION,
          date: "2026-11-07",
          name: "Karma W",
          phone: "01000000902",
          capacity: CAPACITY,
          memberId: karma,
          payment: null,
        });
        assert.equal(result.ok, true);

        const [row] = await store.list("2026-11-07", "2026-11-07");
        assert.equal(row.memberId, karma);
        assert.equal(row.memberNo, "BX-0142", "the number comes from the membership");
        assert.equal(row.payment, null, "a member does not pay for the class");
      });

      it("marks a guest's booking with how they will pay", async () => {
        await store.book({
          sessionId: SESSION,
          date: "2026-11-14",
          name: "Walk In",
          phone: "01000000903",
          capacity: CAPACITY,
          memberId: null,
          payment: "cash",
        });
        const [row] = await store.list("2026-11-14", "2026-11-14");
        assert.equal(row.memberId, null);
        assert.equal(row.memberNo, null);
        assert.equal(row.payment, "cash");
      });

      it("brings the membership off the waitlist with them", async () => {
        // Without this a member who queued came off the queue as a guest,
        // and the desk would ask them to pay again.
        const date = "2026-11-21";
        await store.book({
          sessionId: SESSION,
          date,
          name: "Filler",
          phone: "01000000904",
          capacity: 1,
        });
        await store.joinWaitlist({
          sessionId: SESSION,
          date,
          name: "Karma W",
          phone: "01000000902",
          memberId: karma,
          payment: null,
        });

        const [filler] = await store.list(date, date);
        await store.cancel(filler.id);

        const promoted = await store.promoteFromWaitlist(SESSION, date, 1);
        assert.ok(promoted);
        assert.equal(promoted.memberId, karma, "they queued as a member");
        assert.equal(promoted.memberNo, "BX-0142");
      });

      it("lets two memberships on one phone both book the same class", async () => {
        /*
          The bug this was written for. One place per phone per class is
          right for guests and wrong for members: a Couples & Friends plan
          is two memberships on one number, and the second of the couple was
          refused as a duplicate of the first.
        */
        const date = "2026-11-28";
        const one = await store.addMember({ memberNo: "CF-1", name: "Partner One", phone: "01000000800" });
        const two = await store.addMember({ memberNo: "CF-2", name: "Partner Two", phone: "01000000800" });
        assert.ok(one.ok && two.ok);

        const first = await store.book({
          sessionId: SESSION, date, name: "Partner One", phone: "01000000800",
          capacity: CAPACITY, memberId: one.ok ? one.member.id : null,
        });
        const second = await store.book({
          sessionId: SESSION, date, name: "Partner Two", phone: "01000000800",
          capacity: CAPACITY, memberId: two.ok ? two.member.id : null,
        });
        assert.equal(first.ok, true, "the first of the couple");
        assert.equal(second.ok, true, "and the second, on the same phone");
        assert.equal(await taken(store, date), 2);
      });

      it("still refuses the same membership twice on one class", async () => {
        const date = "2026-11-28";
        const found = await store.findMember("CF-1");
        assert.ok(found.found);
        const again = await store.book({
          sessionId: SESSION, date, name: "Partner One", phone: "01000000800",
          capacity: CAPACITY, memberId: found.member.id,
        });
        assert.equal(again.ok, false);
        assert.equal(again.ok === false && again.reason, "duplicate");
      });

      it("lets a removed member's booking sit beside a guest on the same phone", async () => {
        /*
          Removing a membership turns its bookings into guest bookings - the
          person still turned up, and the class list should still name them.
          With two memberships on one phone, which is what a Couples &
          Friends plan is, removing the second of the couple used to make a
          second guest row on the same phone and class, and the uniqueness
          rule refused it: the removal failed with a duplicate key nobody
          could act on.
        */
        const date = "2027-02-06";
        const a = await store.addMember({ memberNo: "RM-1", name: "One Of Two", phone: "01000000820" });
        const b = await store.addMember({ memberNo: "RM-2", name: "Two Of Two", phone: "01000000820" });
        assert.ok(a.ok && b.ok);

        await store.book({ sessionId: SESSION, date, name: "One Of Two", phone: "01000000820", capacity: CAPACITY, memberId: a.member.id });
        await store.book({ sessionId: SESSION, date, name: "Two Of Two", phone: "01000000820", capacity: CAPACITY, memberId: b.member.id });

        assert.equal(await store.removeMember(a.member.id), true, "the first comes out");
        assert.equal(await store.removeMember(b.member.id), true, "and so does the second");

        const rows = await store.list(date, date);
        assert.equal(rows.length, 2, "both still name who turned up");
        assert.ok(rows.every((r) => r.memberId === null));
      });

      it("still refuses the same guest phone twice on one class", async () => {
        const date = "2026-12-05";
        assert.equal(
          (await store.book({ sessionId: SESSION, date, name: "Walk In", phone: "01000000801", capacity: CAPACITY, payment: "cash" })).ok,
          true,
        );
        const again = await store.book({
          sessionId: SESSION, date, name: "Walk In", phone: "01000000801", capacity: CAPACITY, payment: "cash",
        });
        assert.equal(again.ok, false);
      });

      it("lets the couple queue separately too", async () => {
        const date = "2026-12-12";
        await store.book({ sessionId: SESSION, date, name: "Filler", phone: "01000000802", capacity: 1, payment: "cash" });
        const one = await store.findMember("CF-1");
        const two = await store.findMember("CF-2");
        assert.ok(one.found && two.found);

        assert.equal(
          (await store.joinWaitlist({ sessionId: SESSION, date, name: "Partner One", phone: "01000000800", memberId: one.member.id })).ok,
          true,
        );
        assert.equal(
          (await store.joinWaitlist({ sessionId: SESSION, date, name: "Partner Two", phone: "01000000800", memberId: two.member.id })).ok,
          true,
          "the queue splits the same way booking does",
        );
      });

      it("ticks a guest off as paid, and back again", async () => {
        // What they said they would pay is not what happened. The desk needs
        // the second one.
        const date = "2026-12-19";
        await store.book({
          sessionId: SESSION, date, name: "Owes Money", phone: "01000000803",
          capacity: CAPACITY, payment: "cash",
        });
        const [row] = await store.list(date, date);
        assert.equal(row.paidAt, null, "nobody has paid just by booking");

        assert.equal(await store.setPaid(row.id, true), true);
        assert.notEqual((await store.get(row.id))?.paidAt, null);

        assert.equal(await store.setPaid(row.id, false), true);
        assert.equal((await store.get(row.id))?.paidAt, null);
      });

      it("will not mark a member as paid, because there is nothing to pay", async () => {
        const date = "2026-12-26";
        const found = await store.findMember("CF-1");
        assert.ok(found.found);
        await store.book({
          sessionId: SESSION, date, name: "Partner One", phone: "01000000800",
          capacity: CAPACITY, memberId: found.member.id,
        });
        const [row] = await store.list(date, date);
        assert.equal(await store.setPaid(row.id, true), false);
        assert.equal((await store.get(row.id))?.paidAt, null);
      });

      it("removing a membership leaves the bookings naming the person", async () => {
        const before = await store.list("2026-11-07", "2026-11-07");
        assert.equal(before[0].name, "Karma W");

        assert.equal(await store.removeMember(karma), true);
        assert.equal((await store.findMember("BX-0142")).found, false);

        const after = await store.list("2026-11-07", "2026-11-07");
        assert.equal(after[0].name, "Karma W", "who turned up does not change");
        assert.equal(after[0].memberId, null, "only the link goes");
      });

      it("says no rather than throwing for a membership that is not there", async () => {
        assert.equal(await store.setMemberEnded("nope", true), false);
        assert.equal(await store.removeMember("nope"), false);
        assert.equal((await store.updateMember("nope", { name: "X Y", phone: "01000000905" })).ok, false);
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
