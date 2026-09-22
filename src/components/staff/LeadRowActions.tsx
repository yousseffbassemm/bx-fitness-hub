"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Marking an enquiry dealt with, and undoing it.
 *
 * No two-step confirmation here, unlike cancelling a booking: this changes
 * nothing for the person who enquired and is undone by clicking again.
 */
export default function LeadRowActions({
  id,
  handled,
}: {
  id: string;
  handled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, handled: next }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setBusy(false);
        return setError(data.error ?? "That did not work.");
      }

      router.refresh();
      // The refresh re-renders this row from the server; stay busy until it
      // lands rather than flashing back to idle.
      setTimeout(() => setBusy(false), 400);
    } catch {
      setBusy(false);
      setError("Could not reach the server.");
    }
  }

  return (
    <span className="flex items-center gap-3">
      {error && <span className="text-[0.7rem] text-pink">{error}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={() => set(!handled)}
        className={`font-display rounded-sm border px-3 py-1.5 text-[0.68rem] tracking-[0.1em] transition-colors disabled:opacity-50 ${
          handled
            ? "border-white/15 text-grey-dim hover:border-white/30 hover:text-white"
            : "border-lime/50 text-lime hover:bg-lime hover:text-ink"
        }`}
      >
        {busy ? "…" : handled ? "Reopen" : "Mark done"}
      </button>
    </span>
  );
}
