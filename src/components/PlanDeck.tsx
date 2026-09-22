"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * The membership plans, side by side and swipeable on a phone.
 *
 * Stacked, the three of them ran to most of a screen each and the one worth
 * seeing - the year - was the one you had to scroll past two others to reach.
 * Laid out in a row it opens on that card, with the other two showing at the
 * edges so it is obvious they are there.
 *
 * From lg up this is the plain three-column grid it always was; the scroller
 * only exists below that.
 */
export default function PlanDeck({
  children,
  focus,
}: {
  children: ReactNode;
  /** Index of the card to open on. */
  focus: number;
}) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;

    const centre = () => {
      // At lg this is a grid and there is nothing to scroll.
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      const card = el.children[focus] as HTMLElement | undefined;
      if (!card) return;
      el.scrollLeft = card.offsetLeft + card.offsetWidth / 2 - el.clientWidth / 2;
    };

    // Twice: fonts and the section's own reveal both shift offsets after the
    // first paint, and centring against stale numbers leaves it off to one side.
    centre();
    const settle = window.setTimeout(centre, 350);
    window.addEventListener("load", centre);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("load", centre);
    };
  }, [focus]);

  return (
    <div
      ref={track}
      className="plan-deck -mx-6 mt-9 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:mt-14 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0"
    >
      {children}
    </div>
  );
}
