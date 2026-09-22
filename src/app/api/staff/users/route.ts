import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/staff/password";
import { requireAdmin } from "@/lib/staff/guard";
import { USERNAME_PATTERN } from "@/lib/staff/session";
import { getStore } from "@/lib/store";
import type { StaffRole } from "@/lib/store/types";

// scrypt is Node-only.
export const runtime = "nodejs";

const MIN_PASSWORD = 8;

/** The password if it is usable, otherwise null - so the caller narrows. */
function asPassword(value: unknown) {
  return typeof value === "string" && value.length >= MIN_PASSWORD ? value : null;
}

/** Create an account. */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { username, password, role } = (body ?? {}) as Record<string, unknown>;
  const name = typeof username === "string" ? username.trim().toLowerCase() : "";

  if (!USERNAME_PATTERN.test(name)) {
    return NextResponse.json(
      { error: "Usernames are 3-32 characters: a-z, 0-9, _ and - only." },
      { status: 400 },
    );
  }
  const fresh = asPassword(password);
  if (!fresh) {
    return NextResponse.json(
      { error: `Passwords need at least ${MIN_PASSWORD} characters.` },
      { status: 400 },
    );
  }

  const store = await getStore();
  if (await store.findStaffUser(name)) {
    return NextResponse.json({ error: `"${name}" already exists.` }, { status: 409 });
  }

  const wanted: StaffRole = role === "admin" ? "admin" : "staff";
  await store.upsertStaffUser(name, await hashPassword(fresh), wanted);

  return NextResponse.json({ ok: true, username: name, role: wanted });
}

/** Reset a password, or change a role. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { username, password, role } = (body ?? {}) as Record<string, unknown>;
  const name = typeof username === "string" ? username.trim().toLowerCase() : "";

  const store = await getStore();
  const user = name ? await store.findStaffUser(name) : null;
  if (!user) {
    return NextResponse.json({ error: "No such account." }, { status: 404 });
  }

  if (role !== undefined) {
    if (role !== "admin" && role !== "staff") {
      return NextResponse.json({ error: "Unknown role." }, { status: 400 });
    }

    /*
      Demoting yourself is refused, and so is demoting the last admin. Both
      end the same way: an account screen nobody can open, fixable only by
      someone with a terminal. The store's migration would eventually hand
      admin back to the oldest account, but not until the next restart.
    */
    if (role === "staff") {
      if (name === auth.username) {
        return NextResponse.json(
          { error: "You cannot remove your own admin access." },
          { status: 409 },
        );
      }
      const admins = (await store.listStaffUsers()).filter((u) => u.role === "admin");
      if (admins.length <= 1 && user.role === "admin") {
        return NextResponse.json(
          { error: "That is the only admin left." },
          { status: 409 },
        );
      }
    }

    await store.setStaffRole(name, role);
  }

  if (password !== undefined) {
    const next = asPassword(password);
    if (!next) {
      return NextResponse.json(
        { error: `Passwords need at least ${MIN_PASSWORD} characters.` },
        { status: 400 },
      );
    }
    await store.upsertStaffUser(name, await hashPassword(next), user.role);
  }

  return NextResponse.json({ ok: true });
}

/** Remove an account. */
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { username } = (body ?? {}) as Record<string, unknown>;
  const name = typeof username === "string" ? username.trim().toLowerCase() : "";

  if (name === auth.username) {
    return NextResponse.json(
      { error: "You cannot remove your own account." },
      { status: 409 },
    );
  }

  const store = await getStore();
  const user = await store.findStaffUser(name);
  if (!user) return NextResponse.json({ error: "No such account." }, { status: 404 });

  if (user.role === "admin") {
    const admins = (await store.listStaffUsers()).filter((u) => u.role === "admin");
    if (admins.length <= 1) {
      return NextResponse.json({ error: "That is the only admin left." }, { status: 409 });
    }
  }

  await store.deleteStaffUser(name);
  return NextResponse.json({ ok: true });
}
