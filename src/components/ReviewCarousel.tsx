"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Review } from "@/lib/site";

/** Google's mark, so it is clear where the words came from. */
function GoogleG({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C7.9 41 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.4A13.3 13.3 0 0 1 10.8 24c0-1.5.3-3 .7-4.4l-7.1-5.6A22 22 0 0 0 2 24c0 3.6.9 6.9 2.4 9.9z" />
      <path fill="#EA4335" d="M24 10.6c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.4 29.9 2 24 2 15.4 2 7.9 7 4.4 14l7.1 5.6c1.8-5.3 6.7-9 12.5-9z" />
    </svg>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L1.5 7.7l5.9-.9z"
            fill={n <= Math.round(value) ? "var(--bx-lime)" : "var(--bx-line)"}
          />
        </svg>
      ))}
    </span>
  );
}

/**
 * Reviews as a swipeable deck: the card in the middle is sharp, and its
 * neighbours fall away - smaller, dimmer and progressively blurred the
 * further they sit from the centre.
 *
 * The track is a real scroll container with scroll snapping rather than a
 * hand-written slider. That is what keeps a swipe smooth: the momentum,
 * rubber-banding and snap all come from the browser's own scrolling, which no
 * amount of JavaScript animation matches on a touchscreen. The only thing
 * measured here is how far each card sits from the centre, which drives the
 * blur and scale.
 */
export default function ReviewCarousel({ reviews }: { reviews: Review[] }) {
  const track = useRef<HTMLUListElement>(null);
  const frame = useRef(0);

  const paint = useCallback(() => {
    const el = track.current;
    if (!el) return;

    const mid = el.scrollLeft + el.clientWidth / 2;
    for (const card of Array.from(el.children) as HTMLElement[]) {
      const cardMid = card.offsetLeft + card.offsetWidth / 2;
      // Spread the falloff over more than one card, otherwise the very first
      // neighbour is already fully blurred and the effect reads as on/off
      // rather than as a gradient running away from the middle.
      const d = (cardMid - mid) / (card.offsetWidth * 2.3);
      const clamped = Math.max(-1.2, Math.min(1.2, d));
      card.style.setProperty("--d", clamped.toFixed(3));
      card.style.setProperty("--ad", Math.min(1, Math.abs(clamped)).toFixed(3));
      card.dataset.active = Math.abs(clamped) < 0.5 ? "true" : "false";
    }
  }, []);

  const onScroll = useCallback(() => {
    // One paint per frame; a scroll event can fire far more often than that.
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      paint();
    });
  }, [paint]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;

    // Open on the middle card rather than the first. Done twice: fonts and
    // the section's own reveal both shift offsets after the first paint, and
    // centring against stale numbers leaves the deck sitting off to one side.
    const centre = () => {
      const cards = Array.from(el.children) as HTMLElement[];
      const middle = cards[Math.floor(cards.length / 2)];
      if (!middle) return;
      el.scrollLeft = middle.offsetLeft + middle.offsetWidth / 2 - el.clientWidth / 2;
      paint();
    };
    centre();
    const settle = window.setTimeout(centre, 350);
    const onLoad = () => centre();
    window.addEventListener("load", onLoad);

    const ro = new ResizeObserver(paint);
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(settle);
      window.removeEventListener("load", onLoad);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [paint]);

  /* Drag with a mouse. Touch already works, because the track really scrolls. */
  useEffect(() => {
    const el = track.current;
    if (!el) return;

    let down = false;
    let startX = 0;
    let startLeft = 0;
    let moved = false;

    const start = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.style.scrollSnapType = "none";
      el.style.cursor = "grabbing";
    };

    const move = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
    };

    const end = () => {
      if (!down) return;
      down = false;
      el.style.cursor = "";
      // Handing snapping back lets the browser settle it, instead of this
      // trying to animate to a target and fighting the user's momentum.
      el.style.scrollSnapType = "";
      if (moved) {
        const cards = Array.from(el.children) as HTMLElement[];
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = cards[0];
        let bestGap = Infinity;
        for (const c of cards) {
          const gap = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (gap < bestGap) {
            bestGap = gap;
            best = c;
          }
        }
        el.scrollTo({
          left: best.offsetLeft + best.offsetWidth / 2 - el.clientWidth / 2,
          behavior: "smooth",
        });
      }
    };

    el.addEventListener("pointerdown", start);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      el.removeEventListener("pointerdown", start);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const step = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.children[0] as HTMLElement | undefined;
    if (!card) return;
    const width = card.offsetWidth + 24;
    el.scrollBy({ left: dir * width, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <ul
        ref={track}
        onScroll={onScroll}
        tabIndex={0}
        aria-label="Reviews from Google, use the arrow keys to move between them"
        className="review-track flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 focus-visible:outline-none"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          }
        }}
      >
        {reviews.map((r) => (
          <li key={r.name} className="review-slide snap-center">
            <figure className="flex h-full flex-col rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-7 shadow-[0_30px_70px_-40px_rgba(0,0,0,0.95)]">
              <div className="flex items-center justify-between gap-3">
                <Stars value={r.rating} />
                <GoogleG className="h-4 w-4 opacity-70" />
              </div>

              <blockquote className="mt-5 flex-1 text-[0.95rem] leading-relaxed text-white">
                &ldquo;{r.quote}&rdquo;
              </blockquote>

              <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                <span
                  aria-hidden="true"
                  className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime/15 text-xs text-lime"
                >
                  {r.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-xs text-grey-dim">
                  <span className="font-display block text-[0.8rem] tracking-[0.08em] text-grey">
                    {r.name}
                  </span>
                  {r.when} &middot; {r.source}
                  {r.excerpt && <span className="ml-1.5">&middot; excerpt</span>}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous review"
          className="font-display flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-grey transition-colors hover:border-lime hover:text-lime"
        >
          &#8592;
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next review"
          className="font-display flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-grey transition-colors hover:border-lime hover:text-lime"
        >
          &#8594;
        </button>
        <span className="ml-1 text-xs text-grey-dim">Swipe, drag or use the arrow keys</span>
      </div>
    </div>
  );
}
