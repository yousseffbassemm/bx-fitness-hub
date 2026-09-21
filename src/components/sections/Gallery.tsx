"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { gallery, site } from "@/lib/site";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

export default function Gallery() {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (dir: number) =>
      setOpen((i) => (i === null ? i : (i + dir + gallery.length) % gallery.length)),
    [],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, step]);

  return (
    <section id="gallery" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHead kicker="Gallery" title="Inside" accent="BX." />
          <Reveal>
            <a
              href={site.social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display text-[0.8rem] tracking-[0.12em] text-grey transition-colors hover:text-lime"
            >
              @bx_fitnesshub &rarr;
            </a>
          </Reveal>
        </div>

        {/* Uneven columns so no two rows read the same */}
        <div className="mt-14 columns-2 gap-4 lg:columns-3 [&>*]:mb-4">
          {gallery.map((g, i) => (
            <Reveal key={g.src} delay={(i % 3) * 70}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={`View photo: ${g.alt}`}
                className="group relative block w-full overflow-hidden bg-charcoal"
              >
                <span
                  className={`relative block w-full ${
                    g.ratio === "tall" ? "aspect-[3/4]" : "aspect-square"
                  }`}
                >
                  <Image
                    src={g.src}
                    alt={g.alt}
                    fill
                    loading="lazy"
                    sizes="(max-width: 1024px) 50vw, 33vw"
                    className="plate object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />
                </span>
                <span className="absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/25" />
                <span
                  aria-hidden="true"
                  className="absolute bottom-3 left-3 h-px w-0 bg-lime transition-all duration-500 group-hover:w-10"
                />
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/96 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="font-display absolute right-5 top-5 z-10 px-3 py-2 text-[0.75rem] tracking-[0.14em] text-grey hover:text-white"
          >
            Close
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Previous photo"
            className="font-display absolute left-3 z-10 px-4 py-6 text-2xl text-grey hover:text-lime sm:left-8"
          >
            &#8592;
          </button>

          <figure
            className="relative max-h-[85vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mx-auto h-[70vh] w-full">
              <Image
                src={gallery[open].src}
                alt={gallery[open].alt}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>
            <figcaption className="mt-4 text-center text-xs text-grey-dim">
              {gallery[open].alt}
            </figcaption>
          </figure>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Next photo"
            className="font-display absolute right-3 z-10 px-4 py-6 text-2xl text-grey hover:text-lime sm:right-8"
          >
            &#8594;
          </button>
        </div>
      )}
    </section>
  );
}
