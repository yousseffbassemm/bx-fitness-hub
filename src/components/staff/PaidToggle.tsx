"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Whether a guest has handed the money over.
 *
 * The booking says how they meant to pay; this says whether they did. It is
 * the question the desk is actually asking at seven o'clock, and without it
 * the list read the same for somebody who paid an hour ago and somebody who
 * walked straight past.
 *
 * Never shown on a member's booking - there is nothing for them to pay.
 */
export default function PaidToggle({ id, paid }: { id: string; paid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/staff/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: paid ? "unpaid" : "paid" }),
      });
      if (!res.ok) setError(true);
      else router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={paid}
      title={paid ? "Paid - tap to undo" : "Not paid yet - tap when they pay"}
      className={`font-display rounded-sm border px-2.5 py-1 text-[0.62rem] tracking-[0.1em] uppercase transition-colors disabled:opacity-50 ${
        paid
          ? "border-lime/40 text-lime hover:border-lime"
          : "border-amber/40 text-amber hover:border-amber hover:bg-amber/10"
      }`}
    >
      {error ? "Try again" : paid ? "Paid" : "Owes"}
    </button>
  );
}
