"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EditablePlan } from "@/lib/content";

const field =
  "w-full rounded-sm border border-white/15 bg-ink px-3 py-2.5 text-base text-white placeholder:text-grey-dim focus:border-lime focus:outline-none sm:text-sm";

/**
 * The membership prices.
 *
 * Only price, period and blurb. What each plan includes is a list of real,
 * checked benefits and the layout depends on which plan is featured, so both
 * stay in the code where a change gets reviewed.
 */
export default function PlanEditor({
  plans,
  defaults,
}: {
  plans: EditablePlan[];
  /** The values in the code, for showing what is still a placeholder. */
  defaults: EditablePlan[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(plans);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(plans);

  function edit(name: string, patch: Partial<EditablePlan>) {
    setSaved(false);
    setDraft((d) => d.map((p) => (p.name === name ? { ...p, ...patch } : p)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "plans", value: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        return setError(data.error ?? "That did not save.");
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setBusy(false), 400);
    } catch {
      setBusy(false);
      setError("Could not reach the server.");
    }
  }

  return (
    <div>
      <div className="space-y-4">
        {draft.map((plan) => {
          const original = defaults.find((d) => d.name === plan.name);
          const stillPlaceholder = /^\[.*\]$/.test(plan.price.trim());

          return (
            <div
              key={plan.name}
              className="rounded-sm border border-white/10 bg-charcoal p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base text-white">{plan.name}</h3>
                {stillPlaceholder && (
                  <span className="text-[0.65rem] tracking-[0.12em] text-amber uppercase">
                    Placeholder &mdash; shows on the site as-is
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
                <label className="block">
                  <span className="kicker mb-2 block">Price</span>
                  <input
                    className={field}
                    value={plan.price}
                    placeholder="e.g. 12,000 EGP"
                    onChange={(e) => edit(plan.name, { price: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="kicker mb-2 block">Period</span>
                  <input
                    className={field}
                    value={plan.period}
                    placeholder="e.g. per year"
                    onChange={(e) => edit(plan.name, { period: e.target.value })}
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="kicker mb-2 block">One line under the name</span>
                <input
                  className={field}
                  value={plan.blurb}
                  onChange={(e) => edit(plan.name, { blurb: e.target.value })}
                />
              </label>

              {original && original.price !== plan.price && (
                <p className="mt-2 text-xs text-grey-dim">
                  In the code: {original.price}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-pink">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={save}
          className="font-display rounded-sm bg-lime px-6 py-3 text-[0.75rem] tracking-[0.12em] text-ink transition-colors hover:bg-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save prices"}
        </button>

        {dirty && !busy && (
          <button
            type="button"
            onClick={() => {
              setDraft(plans);
              setError(null);
            }}
            className="text-sm text-grey-dim hover:text-white"
          >
            Undo changes
          </button>
        )}

        {saved && !dirty && (
          <span role="status" className="text-sm text-lime">
            Saved. The site is updated.
          </span>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-grey-dim">
        Prices show exactly as typed, so include the currency. What each plan
        includes is set in the code - ask a developer to change those.
      </p>
    </div>
  );
}
