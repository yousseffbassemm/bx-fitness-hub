"use client";

import { useEffect } from "react";

/**
 * The same backstop for the staff side.
 *
 * Staff hit this while mid-edit, so the wording assumes work in progress:
 * nothing here claims a save went through, because a throw is exactly the
 * case where it may not have.
 */
export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[bx] staff error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <span className="kicker">Something broke</span>
      <h1 className="font-display mt-4 text-3xl leading-tight text-white">
        That screen didn&rsquo;t load
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-grey">
        If you were part-way through a change, check it before doing it again
        &mdash; it may or may not have saved.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="font-display rounded-sm bg-lime px-5 py-3 text-[0.78rem] tracking-[0.12em] text-ink"
        >
          Try again
        </button>
        <a
          href="/staff"
          className="font-display rounded-sm border border-white/15 px-5 py-3 text-[0.78rem] tracking-[0.12em] text-grey hover:text-white"
        >
          Back to the dashboard
        </a>
      </div>
    </div>
  );
}
