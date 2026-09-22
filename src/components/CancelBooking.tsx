"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { forgetToken } from "@/lib/my-bookings";

/**
 * Giving up a place.
 *
 * Two clicks, because it cannot be undone from here - the place goes to
 * whoever is next on the waitlist the moment it is released, so there is
 * nothing to hand back.
 */
export default function CancelBooking({ token }: { token: string }) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/classes/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        setArming(false);
        return setError(data.error ?? "That did not work. Try again, or call us.");
      }
      // Otherwise the timetable would go on saying "You're in" for a place
      // that has just been handed to somebody else.
      forgetToken(token);
      router.refresh();
    } catch {
      setBusy(false);
      setArming(false);
      setError("Could not reach the gym. Try again, or give us a call.");
    }
  }

  return (
    <div className="mt-8">
      {error && (
        <p role="alert" className="mb-4 text-sm text-pink">
          {error}
        </p>
      )}

      {arming ? (
        <div className="rounded-sm border border-pink/40 bg-pink/[0.06] p-5">
          <p className="text-sm leading-relaxed text-white">
            Give up this place? If somebody is waiting for this class, it goes
            to them straight away.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="font-display rounded-sm bg-pink px-5 py-3 text-[0.78rem] tracking-[0.12em] text-white transition-opacity disabled:opacity-60"
            >
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button
              type="button"
              onClick={() => setArming(false)}
              className="font-display px-2 text-[0.78rem] tracking-[0.12em] text-grey hover:text-white"
            >
              Keep my place
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setArming(true)}
          className="font-display w-full rounded-sm border border-white/15 py-4 text-[0.78rem] tracking-[0.12em] text-grey transition-colors hover:border-pink hover:text-pink"
        >
          Cancel this booking
        </button>
      )}
    </div>
  );
}
