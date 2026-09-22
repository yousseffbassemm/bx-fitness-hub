"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { EditableCoach } from "@/lib/content";

const field =
  "w-full rounded-sm border border-white/15 bg-ink px-3 py-2.5 text-base text-white placeholder:text-grey-dim focus:border-lime focus:outline-none sm:text-sm";

/** Where the crop sits vertically. Portraits vary; the card shape does not. */
const CROPS = [
  { label: "Top", value: "center top" },
  { label: "High", value: "center 20%" },
  { label: "Middle", value: "center 40%" },
  { label: "Low", value: "center 60%" },
] as const;

type Row = EditableCoach & {
  /** Set after an upload, so the new photo shows before the page reloads. */
  preview?: string;
  /** Set for coaches whose photo still comes from the code. */
  fallback?: string;
};

export default function CoachEditor({
  coaches,
  fallbacks,
}: {
  coaches: EditableCoach[];
  /** name -> the URL of the photo in the code, for showing what is there now. */
  fallbacks: Record<string, string>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Row[]>(coaches);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const files = useRef<(HTMLInputElement | null)[]>([]);

  const dirty = JSON.stringify(draft.map(strip)) !== JSON.stringify(coaches);

  function strip(r: Row): EditableCoach {
    return {
      name: r.name,
      credential: r.credential,
      disciplines: r.disciplines,
      photoId: r.photoId,
      focus: r.focus,
    };
  }

  function edit(i: number, patch: Partial<Row>) {
    setSaved(false);
    setDraft((d) => d.map((c, n) => (n === i ? { ...c, ...patch } : c)));
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

  async function upload(i: number, file: File) {
    setUploading(i);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/staff/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploading(null);
        return setError(data.error ?? "That upload did not work.");
      }
      edit(i, { photoId: data.id, preview: data.url });
    } catch {
      setError("Could not reach the server.");
    }
    setUploading(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "coaches", value: draft.map(strip) }),
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
        {draft.map((coach, i) => {
          const src = coach.preview ?? (coach.photoId ? `/api/photo/${coach.photoId}` : fallbacks[coach.name]);

          return (
            <div key={i} className="rounded-sm border border-white/10 bg-charcoal p-5">
              <div className="flex flex-wrap gap-5">
                {/* Photo, cropped exactly as the site crops it */}
                <div className="shrink-0">
                  <div className="relative h-40 w-32 overflow-hidden rounded-sm bg-ink">
                    {src ? (
                      <Image
                        src={src}
                        alt=""
                        fill
                        sizes="128px"
                        style={{ objectPosition: coach.focus }}
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center px-2 text-center text-[0.65rem] text-grey-dim">
                        No photo
                      </span>
                    )}
                  </div>

                  <input
                    ref={(el) => {
                      files.current[i] = el;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(i, f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploading === i}
                    onClick={() => files.current[i]?.click()}
                    className="font-display mt-2 w-32 rounded-sm border border-white/15 py-1.5 text-[0.65rem] tracking-[0.1em] text-grey hover:border-lime hover:text-lime disabled:opacity-50"
                  >
                    {uploading === i ? "Uploading…" : "Change photo"}
                  </button>

                  <div className="mt-2 flex w-32 flex-wrap gap-1">
                    {CROPS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => edit(i, { focus: c.value })}
                        className={`rounded-sm border px-1.5 py-1 text-[0.6rem] tracking-[0.06em] ${
                          coach.focus === c.value
                            ? "border-lime text-lime"
                            : "border-white/15 text-grey-dim hover:text-white"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Details */}
                <div className="min-w-[14rem] flex-1 space-y-3">
                  <label className="block">
                    <span className="kicker mb-2 block">Name</span>
                    <input
                      className={field}
                      value={coach.name}
                      onChange={(e) => edit(i, { name: e.target.value })}
                    />
                  </label>

                  <label className="block">
                    <span className="kicker mb-2 block">Credential</span>
                    <input
                      className={field}
                      value={coach.credential}
                      placeholder="Certified Personal Trainer"
                      onChange={(e) => edit(i, { credential: e.target.value })}
                    />
                  </label>

                  <label className="block">
                    <span className="kicker mb-2 block">
                      Specialities, one per line
                    </span>
                    <textarea
                      className={`${field} min-h-[5rem]`}
                      value={coach.disciplines.join("\n")}
                      onChange={(e) =>
                        edit(i, {
                          disciplines: e.target.value.split("\n").map((d) => d),
                        })
                      }
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
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          setSaved(false);
          setDraft((d) => [
            ...d,
            {
              name: "",
              credential: "Certified Personal Trainer",
              disciplines: [],
              photoId: null,
              focus: "center top",
            },
          ]);
        }}
        className="font-display mt-4 w-full rounded-sm border border-dashed border-white/20 py-3 text-[0.72rem] tracking-[0.12em] text-grey hover:border-lime hover:text-lime"
      >
        + Add a coach
      </button>

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
          {busy ? "Saving…" : "Save coaches"}
        </button>

        {dirty && !busy && (
          <button
            type="button"
            onClick={() => {
              setDraft(coaches);
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
        The cards are a tall, fixed shape, so a photograph gets cropped. The
        four buttons under each portrait move the crop up or down - what you
        see here is exactly what the site shows. Portraits work best shot from
        the chest up.
      </p>
    </div>
  );
}
