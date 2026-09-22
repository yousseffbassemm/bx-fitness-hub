import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import BackToSite from "@/components/staff/BackToSite";
import TeamManager from "@/components/staff/TeamManager";
import { Mark } from "@/components/ui/Logo";
import { STAFF_COOKIE, readSessionToken } from "@/lib/staff/session";
import { getStore } from "@/lib/store";

// Accounts change; never serve a cached list.
export const dynamic = "force-dynamic";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  // proxy.ts has already refused anyone without a valid session. The role is
  // checked here, where there is a database to check it against.
  const me = await readSessionToken((await cookies()).get(STAFF_COOKIE)?.value);
  if (!me) redirect("/staff/login");

  const store = await getStore();
  const self = await store.findStaffUser(me);

  // Not an admin: send them to the work they can actually do, rather than
  // showing a page of buttons the server will refuse.
  if (!self || self.role !== "admin") redirect("/staff");

  const members = (await store.listStaffUsers()).map((u) => ({
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <BackToSite className="mb-5" />

        <div className="flex items-center gap-2.5 text-white">
          <Mark className="h-8 w-8" />
          <span className="kicker">Staff &middot; Team</span>
          <span className="text-xs text-grey-dim">&middot; {me}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-white sm:text-4xl">
              {members.length} {members.length === 1 ? "account" : "accounts"}
            </h1>
            <p className="mt-2 text-sm text-grey">
              Who can sign in, and what they are allowed to do.
            </p>
          </div>

          <Link
            href="/staff"
            className="font-display rounded-sm border border-white/15 px-4 py-2 text-[0.72rem] tracking-[0.12em] text-white hover:border-lime hover:text-lime"
          >
            Bookings &amp; enquiries
          </Link>
        </div>
      </header>

      <div className="mt-10">
        <TeamManager members={members} me={me} />
      </div>
    </main>
  );
}
