import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import StaffNav, { type NavItem } from "@/components/staff/StaffNav";
import { Mark } from "@/components/ui/Logo";
import { STAFF_COOKIE, readSessionToken } from "@/lib/staff/session";
import { getStore } from "@/lib/store";

// Who is signed in, and how many enquiries are waiting, on every page.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await readSessionToken((await cookies()).get(STAFF_COOKIE)?.value);
  if (!me) redirect("/staff/login");

  const store = await getStore();
  const self = await store.findStaffUser(me);
  // The account was removed while the session was still valid.
  if (!self) redirect("/staff/login");

  const admin = self.role === "admin";

  // The badge is the reason the section exists: an enquiry nobody has
  // answered is the one thing on these screens that gets worse with time.
  const waiting = (await store.listLeads()).filter((l) => l.handledAt === null).length;

  // Problems only appear in the nav when there are some. A tab that is
  // always there and always empty stops being looked at.
  const problems = admin ? (await store.listErrors(50)).length : 0;

  const items: NavItem[] = [
    { href: "/staff", label: "Bookings" },
    { href: "/staff/enquiries", label: "Enquiries", badge: waiting },
    ...(admin
      ? [
          { href: "/staff/timetable", label: "Timetable" },
          { href: "/staff/coaches", label: "Coaches" },
          { href: "/staff/facilities", label: "Facilities" },
          { href: "/staff/gallery", label: "Gallery" },
          { href: "/staff/pricing", label: "Pricing" },
          { href: "/staff/team", label: "Team" },
          ...(problems > 0
            ? [{ href: "/staff/errors", label: "Problems", badge: problems }]
            : []),
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-ink">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-6">
          {/* Who and where - fixed for the whole session. */}
          <div className="flex h-14 items-center justify-between gap-4">
            <Link href="/staff" className="flex items-center gap-2.5 text-white">
              <Mark className="h-6 w-6" />
              <span className="font-display text-[0.72rem] tracking-[0.18em]">
                BX STAFF
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <span className="hidden text-xs text-grey-dim sm:inline">
                {me}
                <span className="ml-2 text-[0.62rem] tracking-[0.12em] text-grey-dim uppercase">
                  {self.role}
                </span>
              </span>

              <Link
                href="/"
                className="text-xs tracking-[0.08em] text-grey-dim uppercase transition-colors hover:text-lime"
              >
                Site
              </Link>

              <form method="POST" action="/api/staff/logout">
                <button
                  type="submit"
                  className="text-xs tracking-[0.08em] text-grey-dim uppercase transition-colors hover:text-pink"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>

          {/* What you are working on - the only thing that moves. */}
          <StaffNav items={items} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">{children}</main>
    </div>
  );
}
