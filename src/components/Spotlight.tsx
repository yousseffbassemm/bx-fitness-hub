"use client";

import { useEffect } from "react";

/**
 * Writes the pointer's position onto whichever surface it is over, so each
 * card's glow can follow it.
 *
 * One delegated listener for the whole page, coalesced to one write per
 * animation frame. Attaching a listener per card, or setting a variable on
 * every pointermove, is a lot of work to repeat dozens of times a second for
 * a lighting effect.
 */
export default function Spotlight() {
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;

    let frame = 0;
    let pending: { el: HTMLElement; x: number; y: number } | null = null;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(".surface");
      if (!el) return;

      const r = el.getBoundingClientRect();
      pending = { el, x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };

      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!pending) return;
        pending.el.style.setProperty("--mx", `${pending.x.toFixed(1)}%`);
        pending.el.style.setProperty("--my", `${pending.y.toFixed(1)}%`);
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
