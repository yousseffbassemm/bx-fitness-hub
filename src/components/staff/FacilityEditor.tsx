"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PhotoField from "./PhotoField";
import { useUpload } from "@/lib/useUpload";
import type { EditableFacility } from "@/lib/content";

const field =
  "w-full rounded-sm border border-white/15 bg-ink px-3 py-2.5 text-base text-white placeholder:text-grey-dim focus:border-lime focus:outline-none sm:text-sm";

/** The facility cards are 3:2 on a phone and 4:5 above it - both get cropped. */
const CROPS = [
  { label: "Top", value: "center 20%" },
  { label: "Middle", value: "center" },
  { label: "Low", value: "center 75%" },
];

type Row = EditableFacility & { preview?: string };

export default function FacilityEditor({
  facilities,
  fallbacks,
}: {
  facilities: EditableFacility[];
  /** Position -> the photo in the code, for ones never re-uploaded. */
  /** The title in the code -> the photo it ships with. */
  fallbacks: Record<string, string>;
}) {
  const router = useRouter();
  const { upload, uploading, error: uploadError, setError } = useUpload();
  const [draft, setDraft] = useState<Row[]>(facilities);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const strip = (r: Row): EditableFacility => ({
    base: r.base ?? null,
    title: r.title,
    copy: r.copy,
    alt: r.alt,
    photoId: r.photoId,
    focus: r.focus,
  });

  const dirty = JSON.stringify(draft.map(strip)) !== JSON.stringify(facilities);

  function edit(i: number, patch: Partial<Row>) {
    setSaved(false);
    setDraft((d) => d.map((f, n) => (n === i ? { ...f, ...patch } : f)));
  }

  function move(i: number, by: number) {
    const to = i + by;
    if (to < 0 || to >= draft.length) return;
    setSaved(false);
    setDraft((d) => {
      const next = [...d];
      [next[i], next[to]] = [next[to], next[i]];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/staff/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "facilities", value: draft.map(strip) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        return setSaveError(data.error ?? "That did not save.");
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setBusy(false), 400);
    } catch {
      setBusy(false);
      setSaveError("Could not reach the server.");
    }
  }

  return (
    <div>
      <div className="space-y-4">
        {draft.map((f, i) => (
          <div key={i} className="rounded-sm border border-white/10 bg-charcoal p-5">
            <div className="flex flex-wrap gap-5">
              <PhotoField
                src={f.preview ?? (f.photoId ? `/api/photo/${f.photoId}` : fallbacks[f.base ?? f.title])}
                focus={f.focus}
                aspect="aspect-[4/5]"
                busy={uploading === i}
                crops={CROPS}
                onFocus={(value) => edit(i, { focus: value })}
                onFile={async (file) => {
                  setError(null);
                  const up = await upload(i, file);
                  if (up) edit(i, { photoId: up.id, preview: up.url });
                }}
              />

              <div className="min-w-[14rem] flex-1 space-y-3">
                <label className="block">
                  <span className="kicker mb-2 block">Name</span>
                  <input
                    className={field}
                    value={f.title}
                    onChange={(e) => edit(i, { title: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="kicker mb-2 block">One line about it</span>
                  <textarea
                    className={`${field} min-h-[4.5rem]`}
                    value={f.copy}
                    onChange={(e) => edit(i, { copy: e.target.value })}
                  />
                </label>

                <label className="block">
                  <span className="kicker mb-2 block">
                    Describe the photo, for screen readers
                  </span>
                  <input
                    className={field}
                    value={f.alt}
                    onChange={(e) => edit(i, { alt: e.target.value })}
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="rounded-sm border border-white/15 px-2.5 py-1 text-xs text-grey hover:border-lime hover:text-lime disabled:opacity-30"
                  >
                    &uarr; Up
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === draft.length - 1}
                    className="rounded-sm border border-white/15 px-2.5 py-1 text-xs text-grey hover:border-lime hover:text-lime disabled:opacity-30"
                  >
                    &darr; Down
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaved(false);
                      setDraft((d) => d.filter((_, n) => n !== i));
                    }}
                    className="ml-auto rounded-sm border border-white/15 px-2.5 py-1 text-xs text-grey hover:border-pink hover:text-pink"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setSaved(false);
          setDraft((d) => [
            ...d,
            { title: "", copy: "", alt: "", photoId: null, focus: "center" },
          ]);
        }}
        className="font-display mt-4 w-full rounded-sm border border-dashed border-white/20 py-3 text-[0.72rem] tracking-[0.12em] text-grey hover:border-lime hover:text-lime"
      >
        + Add a facility
      </button>

      {(saveError || uploadError) && (
        <p role="alert" className="mt-4 text-sm text-pink">
          {saveError ?? uploadError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={save}
          className="font-display rounded-sm bg-lime px-6 py-3 text-[0.75rem] tracking-[0.12em] text-ink transition-colors hover:bg-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save facilities"}
        </button>

        {dirty && !busy && (
          <button
            type="button"
            onClick={() => {
              setDraft(facilities);
              setSaveError(null);
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
    </div>
  );
}
