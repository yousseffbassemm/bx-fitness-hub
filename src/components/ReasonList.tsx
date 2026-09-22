"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

/** Furthest a row is pushed, in row heights. Past this the blur stops growing:
 *  the gradient wants to concentrate around the pointer, and a 7px blur on
 *  text at the far end of the list is expensive for something nobody reads. */
const FALLOFF = 4;

/**
 * Blur that radiates from wherever the reader is pointing.
 *
 * The distance is measured from the pointer itself, in row heights, and it is
 * continuous: a row half a row away is 0.5. That matters more than it sounds.
 * Measuring it per row index instead - which is what this did at first - means
 * the whole list only changes when the pointer crosses a boundary, so moving
 * down a 135px row does nothing at all and then everything jumps a full step
 * at once. Six frozen states, not a gradient.
 *
 * Because --dist now follows the pointer frame by frame, the CSS transition
 * comes off while tracking. A transition would be easing towards a target that
 * has already moved by the time it gets there, which is the lag you feel as
 * the effect chasing you rather than sitting where you are looking.
 *
 * On a touchscreen there is no pointer, so TouchFocus writes the same variable
 * off the scroll position and the handlers here stand down.
 */
export default function ReasonList({ children }: { children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  const frame = useRef(0);
  const pointerY = useRef(0);
  const settle = useRef(0);

  const paint = useCallback(() => {
    frame.current = 0;
    const el = list.current;
    if (!el) return;
    const rows = Array.from(el.children) as HTMLElement[];
    // Read every rect before writing anything: interleaving them makes the
    // browser re-run layout between each pair.
    const centres = rows.map((row) => {
      const b = row.getBoundingClientRect();
      return { mid: b.top + b.height / 2, h: b.height || 1 };
    });
    rows.forEach((row, i) => {
      const d = Math.min(FALLOFF, Math.abs(pointerY.current - centres[i].mid) / centres[i].h);
      // Quantised, and only written when it actually changes. Every distinct
      // value is a fresh blur rasterisation of a block of text; at full
      // precision that is six of them every frame the pointer twitches. A
      // step of 0.02 moves the radius by 0.027px - nothing anyone can see -
      // and holds still through the small movements.
      const q = (Math.round(d * 50) / 50).toFixed(2);
      if (row.style.getPropertyValue("--dist") !== q) {
        row.style.setProperty("--dist", q);
      }
    });
  }, []);

  /** Wake the effect and follow the pointer. Waking happens here rather than
   *  on enter alone, so a cursor that is already sitting over the list when it
   *  renders - or an enter that never arrives - still brings it to life. */
  const track = useCallback(
    (y: number) => {
      pointerY.current = y;
      const el = list.current;
      if (el && !el.dataset.live) {
        el.dataset.live = "true";
        // Ease from flat into the gradient, then hand over to frame-by-frame
        // tracking once it has arrived.
        el.dataset.entering = "true";
        window.clearTimeout(settle.current);
        settle.current = window.setTimeout(() => {
          delete el.dataset.entering;
        }, 200);
      }
      if (!frame.current) frame.current = requestAnimationFrame(paint);
    },
    [paint],
  );

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      window.clearTimeout(settle.current);
    },
    [],
  );

  // Some touch browsers fire pointer events on tap; letting them through would
  // leave the focus stuck wherever the screen was last touched.
  const hasPointer = () =>
    typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

  return (
    <ul
      ref={list}
      data-focus-group
      className="reasons"
      onPointerEnter={(e) => {
        if (!hasPointer()) return;
        track(e.clientY);
      }}
      onPointerMove={(e) => {
        if (!hasPointer()) return;
        track(e.clientY);
      }}
      onPointerLeave={() => {
        const el = list.current;
        if (!el) return;
        window.clearTimeout(settle.current);
        delete el.dataset.live;
        delete el.dataset.entering;
        for (const row of Array.from(el.children) as HTMLElement[]) {
          row.style.setProperty("--dist", "0");
        }
      }}
    >
      {children}
    </ul>
  );
}
