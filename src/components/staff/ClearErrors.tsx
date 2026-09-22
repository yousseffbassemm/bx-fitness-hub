"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Clears the list once the problems have been dealt with. */
export default function ClearErrors() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/staff/errors", { method: "DELETE" }).catch(() => {});
        router.refresh();
        setTimeout(() => setBusy(false), 400);
      }}
      className="font-display rounded-sm border border-white/15 px-4 py-2 text-[0.72rem] tracking-[0.12em] text-grey transition-colors hover:border-lime hover:text-lime disabled:opacity-50"
    >
      {busy ? "Clearing…" : "Clear the list"}
    </button>
  );
}
