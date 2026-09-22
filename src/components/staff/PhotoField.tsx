"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/**
 * Upload and crop one photograph.
 *
 * Shared by coaches, facilities and the gallery, because it is the same job
 * in all three: pick a file, see it cropped the way the page will crop it,
 * and move the crop if the subject is not in the middle. The preview shape
 * is passed in, so what is on screen here matches what the site shows.
 */
export default function PhotoField({
  src,
  focus,
  aspect,
  busy,
  onFile,
  onFocus,
  crops,
}: {
  src: string | undefined;
  focus?: string;
  /** Tailwind aspect class matching how the site renders it. */
  aspect: string;
  busy: boolean;
  onFile: (file: File) => void;
  onFocus?: (value: string) => void;
  crops?: { label: string; value: string }[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div className="w-32 shrink-0">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className={`relative w-full overflow-hidden rounded-sm bg-ink ${aspect} ${
          over ? "ring-2 ring-lime" : ""
        }`}
      >
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="128px"
            style={focus ? { objectPosition: focus } : undefined}
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-[0.65rem] text-grey-dim">
            No photo
          </span>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="font-display mt-2 w-full rounded-sm border border-white/15 py-1.5 text-[0.65rem] tracking-[0.1em] text-grey hover:border-lime hover:text-lime disabled:opacity-50"
      >
        {busy ? "Uploading…" : src ? "Change photo" : "Add photo"}
      </button>

      {crops && onFocus && (
        <div className="mt-2 flex flex-wrap gap-1">
          {crops.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onFocus(c.value)}
              className={`rounded-sm border px-1.5 py-1 text-[0.6rem] tracking-[0.06em] ${
                focus === c.value
                  ? "border-lime text-lime"
                  : "border-white/15 text-grey-dim hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
