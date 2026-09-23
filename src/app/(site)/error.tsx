"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { site } from "@/lib/site";

/**
 * The backstop for anything on the public site that throws.
 *
 * Without this file React unmounts the whole tree and Next renders its own
 * error page: no navbar, no footer, no phone number, and in production not
 * even a sentence explaining itself. That is the worst possible answer to
 * give somebody who was trying to book a class, so this one keeps the
 * chrome, says what happened in plain words, and offers the two things
 * that actually help - try again, or ring the gym.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server-side ones are already in Problems; this catches the rest.
    console.error("[bx] site error", error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-24">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-pink" />
        <span className="kicker">Something broke</span>
      </div>

      <h1 className="font-display mt-6 text-4xl leading-tight text-white">
        That didn&rsquo;t <span className="text-lime">work.</span>
      </h1>

      <p className="mt-5 text-sm leading-relaxed text-grey">
        Our side, not yours. Try again &mdash; it often comes back on the
        second go. If you were booking a class and it matters today, call us
        and we will put you in by hand.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="font-display inline-flex items-center justify-center gap-2 rounded-none bg-lime px-6 py-3.5 text-[0.8rem] tracking-[0.12em] text-ink transition-all duration-200 hover:bg-white active:scale-[0.98]"
        >
          Try again
        </button>
        <Button href={site.phone.href} variant="outline">
          Call {site.phone.display}
        </Button>
      </div>
    </section>
  );
}
