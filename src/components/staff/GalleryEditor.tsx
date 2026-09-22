"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PhotoField from "./PhotoField";
import { useUpload } from "@/lib/useUpload";
import type { EditableGalleryItem, GalleryRatio } from "@/lib/content";

type Row = EditableGalleryItem & { preview?: string };

/**
 * The gallery grid.
 *
 * Laid out here as a grid rather than a list, because the gallery on the site
 * is a mosaic and the only thing worth seeing while editing it is how the
 * tall and square tiles fall next to each other.
 */
export default function GalleryEditor({
  items,
  fallbacks,
}: {
  items: EditableGalleryItem[];
  fallbacks: string[];
}) {
  const router = useRouter();
  const { upload, uploading, error: uploadError, setError } = useUpload();
  const [draft, setDraft] = useState<Row[]>(items);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const strip = (r: Row): EditableGalleryItem => ({
    alt: r.alt,
    ratio: r.ratio,
    photoId: r.photoId,
  });

  const dirty = JSON.stringify(draft.map(strip)) !== JSON.stringify(items);

  function edit(i: number, patch: Partial<Row>) {
    setSaved(false);
    setDraft((d) => d.map((g, n) => (n === i ? { ...g, ...patch } : g)));
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
        body: JSON.stringify({ key: "gallery", value: draft.map(strip) }),
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {draft.map((g, i) => (
          <div key={i} className="rounded-sm border border-white/10 bg-charcoal p-4">
            <PhotoField
              src={g.preview ?? (g.photoId ? `/api/photo/${g.photoId}` : fallbacks[i])}
              aspect={g.ratio === "tall" ? "aspect-[3/4]" : "aspect-square"}
              busy={uploading === i}
              onFile={async (file) => {
                setError(null);
                const up = await upload(i, file);
                if (up) edit(i, { photoId: up.id, preview: up.url });
              }}
            />

            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="kicker mb-1.5 block">Describe it</span>
                <textarea
                  className="min-h-[3.5rem] w-full rounded-sm border border-white/15 bg-ink px-2.5 py-2 text-[0.8rem] text-white focus:border-lime focus:outline-none"
                  value={g.alt}
                  onChange={(e) => edit(i, { alt: e.target.value })}
                />
              </label>

              <div className="flex flex-wrap items-center gap-1.5">
                {(["tall", "square"] as GalleryRatio[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => edit(i, { ratio: r })}
                    className={`rounded-sm border px-2 py-1 text-[0.62rem] tracking-[0.08em] capitalize ${
                      g.ratio === r
                        ? "border-lime text-lime"
                        : "border-white/15 text-grey-dim hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="ml-auto rounded-sm border border-white/15 px-2 py-1 text-[0.62rem] text-grey hover:border-lime hover:text-lime disabled:opacity-30"
                >
                  &larr;
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === draft.length - 1}
                  className="rounded-sm border border-white/15 px-2 py-1 text-[0.62rem] text-grey hover:border-lime hover:text-lime disabled:opacity-30"
                >
                  &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaved(false);
                    setDraft((d) => d.filter((_, n) => n !== i));
                  }}
                  className="rounded-sm border border-white/15 px-2 py-1 text-[0.62rem] text-grey hover:border-pink hover:text-pink"
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setSaved(false);
          setDraft((d) => [...d, { alt: "", ratio: "square", photoId: null }]);
        }}
        className="font-display mt-4 w-full rounded-sm border border-dashed border-white/20 py-3 text-[0.72rem] tracking-[0.12em] text-grey hover:border-lime hover:text-lime"
      >
        + Add a photo
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
          {busy ? "Saving…" : "Save gallery"}
        </button>

        {dirty && !busy && (
          <button
            type="button"
            onClick={() => {
              setDraft(items);
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

      <p className="mt-4 text-xs leading-relaxed text-grey-dim">
        Tall tiles take two rows on the site and square ones take one, which is
        what makes the grid a mosaic rather than a wall of squares.
      </p>
    </div>
  );
}
