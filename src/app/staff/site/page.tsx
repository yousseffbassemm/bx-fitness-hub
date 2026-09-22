import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import BackToSite from "@/components/staff/BackToSite";
import CoachEditor from "@/components/staff/CoachEditor";
import PlanEditor from "@/components/staff/PlanEditor";
import { Mark } from "@/components/ui/Logo";
import { defaultPlanValues, getEditableCoaches, getEditablePlans } from "@/lib/content";
import { coaches as codeCoaches } from "@/lib/site";
import { STAFF_COOKIE, readSessionToken } from "@/lib/staff/session";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Site content" };

export default async function SiteContentPage() {
  const me = await readSessionToken((await cookies()).get(STAFF_COOKIE)?.value);
  if (!me) redirect("/staff/login");

  const store = await getStore();
  const self = await store.findStaffUser(me);
  if (!self || self.role !== "admin") redirect("/staff");

  const plans = await getEditablePlans();
  const coaches = await getEditableCoaches();

  // The photographs that ship in the code, so a coach who has never had one
  // uploaded still shows the picture the site is currently using.
  const fallbacks = Object.fromEntries(
    codeCoaches.map((c) => [c.name, c.photo.src]),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <BackToSite className="mb-5" />

        <div className="flex items-center gap-2.5 text-white">
          <Mark className="h-8 w-8" />
          <span className="kicker">Staff &middot; Site content</span>
          <span className="text-xs text-grey-dim">&middot; {me}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-white sm:text-4xl">
              Site content
            </h1>
            <p className="mt-2 text-sm text-grey">
              Changes appear on the site as soon as you save.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/staff"
              className="font-display rounded-sm border border-white/15 px-4 py-2 text-[0.72rem] tracking-[0.12em] text-white hover:border-lime hover:text-lime"
            >
              Bookings
            </Link>
            <Link
              href="/staff/team"
              className="font-display rounded-sm border border-white/15 px-4 py-2 text-[0.72rem] tracking-[0.12em] text-white hover:border-lime hover:text-lime"
            >
              Team
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-12">
        <h2 className="font-display border-b border-white/10 pb-3 text-lg text-lime">
          Membership prices
        </h2>
        <div className="mt-6">
          <PlanEditor plans={plans} defaults={defaultPlanValues()} />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display border-b border-white/10 pb-3 text-lg text-lime">
          Coaches
        </h2>
        <div className="mt-6">
          <CoachEditor coaches={coaches} fallbacks={fallbacks} />
        </div>
      </section>
    </main>
  );
}
