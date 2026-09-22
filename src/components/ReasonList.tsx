"use client";

import { useCallback, useRef } from "react";
import type { ReactNode } from "react";

/**
 * Blur that radiates from whatever the reader is pointing at.
 *
 * The distance has to be measured from the hovered row, not baked in per
 * index, so the same row reads sharp wherever it sits in the list. CSS has no
 * way to express "how far is this sibling from the hovered one", so the
 * distance is written straight onto each row as a variable - no React state,
 * because re-rendering the whole list on every pointer move would be far more
 * work than setting six custom properties.
 */
export default function ReasonList({ children }: { children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);

  const spread = useCallback((from: number | null) => {
    const el = list.current;
    if (!el) return;
    const rows = Array.from(el.children) as HTMLElement[];
    rows.forEach((row, i) => {
      row.style.setProperty("--dist", from === null ? "0" : String(Math.abs(i - from)));
    });
  }, []);

  return (
    <ul
      ref={list}
      className="reasons"
      onPointerLeave={() => spread(null)}
      onPointerOver={(e) => {
        const el = list.current;
        if (!el) return;
        const row = (e.target as HTMLElement).closest("li");
        if (!row || row.parentElement !== el) return;
        spread(Array.from(el.children).indexOf(row));
      }}
    >
      {children}
    </ul>
  );
}
