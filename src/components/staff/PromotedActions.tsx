"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Ticks off someone who has been told a place came free. */
export default function PromotedActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function told() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "told" }),
      });
      if (!res.ok) {
        setBusy(false);
        const data = await res.json().catch(() => ({}));
        return setError(data.error ?? "That did not work.");
      }
      router.refresh();
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
        onClick={told}
        aria-label={`Mark ${name} as told`}
        className="font-display rounded-sm border border-lime/50 px-3 py-1.5 text-[0.68rem] tracking-[0.1em] text-lime transition-colors hover:bg-lime hover:text-ink disabled:opacity-50"
      >
        {busy ? "…" : "Told them"}
      </button>
    </span>
  );
}
