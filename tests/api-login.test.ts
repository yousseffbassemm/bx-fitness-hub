import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { post, read, send, SITE } from "./support/http.ts";

/*
  The front door, and the two routes that end a session.

  Nothing here had a test. The login route is the only thing standing in
  front of every member's phone number, and several of its decisions are the
  kind that look fine and are not: whether a wrong password and an
  unreachable database are told apart, whether guessing is throttled, and
  whether it ever says which half of the pair was wrong.
*/

const tmp = path.join(os.tmpdir(), `bx-api-login-${process.pid}.db`);
process.env.BOOKINGS_DB_PATH = tmp;
process.env.STAFF_SESSION_SECRET = "a-test-secret-long-enough-to-be-accepted-0123456789";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { supabaseConfigured } = await import("../src/lib/store/supabase.ts");
assert.equal(supabaseConfigured, false, "must never run against the real database");

const { POST: login } = await import("../src/app/api/staff/login/route.ts");
const { POST: logout } = await import("../src/app/api/staff/logout/route.ts");
const { GET: sessionEnded } = await import("../src/app/api/staff/session-ended/route.ts");
const { hashPassword } = await import("../src/lib/staff/password.ts");
const { STAFF_COOKIE, readSessionToken } = await import("../src/lib/staff/session.ts");
const { getStore } = await import("../src/lib/store/index.ts");

const PASSWORD = "a real staff password";

before(async () => {
  await (await getStore()).upsertStaffUser("boss", await hashPassword(PASSWORD), "admin");
});

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(tmp + suffix, { force: true });
});

let caller = 0;
/** Its own address each time, so one test's guesses do not throttle the next. */
const from = () => ({ ip: `198.51.100.${++caller % 250}` });

const tryLogin = (body: unknown, options = {}) =>
  login(post("/api/staff/login", body, { ...from(), ...options }));

/** The session cookie a response sets, if it sets one. */
const cookieFrom = (res: Response) => {
  const header = res.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${STAFF_COOKIE}=([^;]*)`));
  return match ? match[1] : null;
};

describe("signing in", () => {
  it("lets the right pair in, and hands back a session", async () => {
    const res = await tryLogin({ username: "boss", password: PASSWORD });
    const { status, body } = await read(res.clone());

    assert.equal(status, 200);
    assert.equal(body.username, "boss");

    const cookie = cookieFrom(res);
    assert.ok(cookie, "a session cookie has to come back");
    assert.equal(await readSessionToken(cookie!), "boss", "and it has to be a real one");
  });

  it("sets a cookie the page's own scripts cannot read", async () => {
    const res = await tryLogin({ username: "boss", password: PASSWORD });
    const header = res.headers.get("set-cookie") ?? "";
    assert.match(header, /HttpOnly/i, "anything else is one XSS away from the member list");
    assert.match(header, /SameSite=lax/i);
    assert.match(header, /Path=\//i);
  });

  it("refuses the wrong password, and gives nothing away", async () => {
    const wrong = await read(await tryLogin({ username: "boss", password: "not it" }));
    const nobody = await read(await tryLogin({ username: "ghost", password: PASSWORD }));

    assert.equal(wrong.status, 401);
    assert.equal(nobody.status, 401);
    // The same words either way: a different message for an unknown user
    // would let somebody map who has an account.
    assert.equal(wrong.body.error, nobody.body.error);
    assert.doesNotMatch(String(wrong.body.error), /password is|no such user|unknown/i);
  });

  it("hands back no cookie when it refuses", async () => {
    const res = await tryLogin({ username: "boss", password: "not it" });
    assert.equal(cookieFrom(res), null);
  });

  it("wants both halves before it does any work", async () => {
    for (const body of [
      {},
      { username: "boss" },
      { password: PASSWORD },
      { username: "", password: "" },
      { username: 5, password: PASSWORD },
      { username: "boss", password: null },
    ]) {
      const { status } = await read(await tryLogin(body));
      assert.equal(status, 400, `should refuse ${JSON.stringify(body)}`);
    }
  });

  it("refuses a body that is not JSON", async () => {
    const { status } = await read(await tryLogin("{not json"));
    assert.equal(status, 400);
  });

  it("stops somebody guessing over and over", async () => {
    const ip = { ip: "203.0.113.250" };
    let sawLimit = false;

    for (let i = 0; i < 12; i += 1) {
      const { status } = await read(
        await login(post("/api/staff/login", { username: "boss", password: `guess ${i}` }, ip)),
      );
      if (status === 429) {
        sawLimit = true;
        break;
      }
    }
    assert.ok(sawLimit, "guessing has to be throttled");

    // And the throttle holds even once they guess right, so it cannot be
    // used to discover the password one attempt past the limit.
    const { status } = await read(
      await login(post("/api/staff/login", { username: "boss", password: PASSWORD }, ip)),
    );
    assert.equal(status, 429);
  });

  it("throttles per address, not everybody at once", async () => {
    // The desk and somebody guessing from outside are not the same caller.
    const { status } = await read(await tryLogin({ username: "boss", password: PASSWORD }));
    assert.equal(status, 200, "one address being throttled must not lock the gym out");
  });

  it("tells an unreachable database apart from a wrong password", async () => {
    /*
      These were reported as the same thing: the store threw, the route
      answered 500 with no body, and the form fell back to "Could not sign
      you in." Somebody with the right password would sit there retyping it
      while the database was simply down.
    */
    const store = await getStore();
    const real = store.findStaffUser;
    store.findStaffUser = async () => {
      throw new Error("connect ECONNREFUSED");
    };
    try {
      const { status, body } = await read(await tryLogin({ username: "boss", password: PASSWORD }));
      assert.equal(status, 503, "not 401, and not a bare 500");
      assert.match(String(body.error), /try again|cannot reach/i);
    } finally {
      store.findStaffUser = real;
    }
  });
});

describe("ending a session", () => {
  it("clears the cookie and sends them to the login screen", async () => {
    const res = await logout(post("/api/staff/logout", {}));
    assert.equal(res.status, 303);
    assert.match(res.headers.get("location") ?? "", /\/staff\/login$/);
    assert.match(res.headers.get("set-cookie") ?? "", /Max-Age=0/i);
  });

  it("breaks the redirect loop when the account is gone", async () => {
    /*
      The Edge gate can only see that a token is signed and unexpired, which
      a removed colleague's cookie still is. It lets them through, the page
      finds no account and bounces them to login, the gate sees the same
      valid signature and sends them back: a loop, in exactly the situation
      the Team screen exists for. This is what breaks it.
    */
    const res = await sessionEnded(send("GET", "/api/staff/session-ended", undefined));
    const to = new URL(res.headers.get("location") ?? "", SITE);

    assert.equal(to.pathname, "/staff/login");
    assert.equal(to.searchParams.get("ended"), "1", "the screen says why they were signed out");
    assert.match(res.headers.get("set-cookie") ?? "", /Max-Age=0|Expires=/i);
  });
});
