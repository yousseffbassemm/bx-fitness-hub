import { Suspense } from "react";
import { staffAuthConfigured } from "@/lib/staff/session";
import SessionEndedNote from "@/components/staff/SessionEndedNote";
import StaffLoginForm from "@/components/staff/StaffLoginForm";
import BackToSite from "@/components/staff/BackToSite";
import { Mark } from "@/components/ui/Logo";

export default function StaffLoginPage() {
  const configured = staffAuthConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <BackToSite className="mb-8" />
        <div className="flex items-center gap-2.5 text-white">
          <Mark className="h-9 w-9" />
          <span className="font-display text-[0.92rem] leading-none tracking-tight">
            BX
            <br />
            Fitness Hub
          </span>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <span className="h-px w-8 bg-lime" />
          <span className="kicker">Staff</span>
        </div>
        <h1 className="font-display mt-4 text-3xl text-white">Class bookings.</h1>

        {/* Reads a query parameter, so it needs the same boundary the form
            below it does on a prerendered page. */}
        <Suspense fallback={null}>
          <SessionEndedNote />
        </Suspense>

        {configured ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-grey">
              Sign in with your own username to see today&apos;s list.
            </p>
            {/* The form reads ?next= , so it needs a boundary on a
                prerendered page. */}
            <div className="mt-8">
              <Suspense
                fallback={
                  <div className="h-[9.5rem] animate-pulse rounded-sm bg-charcoal" />
                }
              >
                <StaffLoginForm />
              </Suspense>
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-sm border border-amber/40 bg-amber/5 p-5">
            <p className="text-sm leading-relaxed text-grey">
              The staff area is not configured on this server. Generate the two
              values with{" "}
              <code className="text-white">
                node scripts/staff-user.mjs add &lt;username&gt;
              </code>{" "}
              and set <code className="text-white">STAFF_SESSION_SECRET</code>.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
