"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Cancelling is destructive, so it takes two clicks: the first arms it, the
 * second does it. Cancelling is reversible - the row is kept and the place
 * freed - so an undo sits next to a cancelled booking until the class fills.
 */
export default function BookingRowActions({
  id,
  cancelled,
  name,
}: {
  id: string;
  cancelled: boolean;
  name: string;
}) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "cancel" | "restore") {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/staff/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setBusy(false);
        setArming(false);
        return setError(data.error ?? "That did not work.");
      }

      setArming(false);
      router.refresh();
      // The refresh re-renders this row from the server, so leave it busy
      // until that lands rather than flashing back to an idle state.
      setTimeout(() => setBusy(false), 400);
    } catch {
      setBusy(false);
      setArming(false);
      setError("Could not reach the server.");
    }
  }

  if (cancelled) {
    return (
      <span className="flex items-center gap-3">
        {error && <span className="text-[0.7rem] text-pink">{error}</span>}
        <button
          type="button"
          disabled={busy}
          onClick={() => run("restore")}
          className="text-[0.7rem] tracking-[0.1em] text-grey-dim uppercase transition-colors hover:text-lime disabled:opacity-50"
        >
          {busy ? "…" : "Undo"}
        </button>
      </span>
    );
  }

  if (arming) {
    return (
      <span className="flex items-center gap-3">
        <span className="text-[0.7rem] text-grey">Cancel {name.split(" ")[0]}?</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("cancel")}
          className="rounded-sm bg-pink px-2.5 py-1 text-[0.7rem] font-semibold tracking-[0.08em] text-white uppercase disabled:opacity-50"
        >
          {busy ? "…" : "Yes"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setArming(false)}
          className="text-[0.7rem] tracking-[0.1em] text-grey-dim uppercase hover:text-white"
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3">
      {error && <span className="text-[0.7rem] text-pink">{error}</span>}
      <button
        type="button"
        onClick={() => setArming(true)}
        aria-label={`Cancel the booking for ${name}`}
        className="text-[0.7rem] tracking-[0.1em] text-grey-dim uppercase transition-colors hover:text-pink"
      >
        Cancel
      </button>
    </span>
  );
}
