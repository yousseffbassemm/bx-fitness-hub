"use client";

import { useEffect } from "react";

/** Furthest an item is pushed, in its own heights - matches ReasonList. */
const FALLOFF = 4;

type Item = { el: HTMLElement; card: HTMLElement; mid: number; h: number };
type Group = { items: Item[]; top: number; bottom: number };

/**
 * The reader's scroll standing in for the pointer.
 *
 * Almost every piece of emphasis on this site hangs off :hover - the photo
 * that zooms, the lime rule that draws itself along the bottom of a card, the
 * blur that radiates away from one of the six reasons. On a phone none of it
 * ever fires, and the page goes flat exactly where it was meant to come alive.
 *
 * So on a touchscreen the thing nearest the middle of the screen takes the
 * focus instead, and moves as you scroll. It is marked data-near, which the
 * same rules key off, so there is one description of each effect rather than
 * a hover version and a touch version drifting apart.
 *
 * Geometry is measured once and kept in document coordinates, so a scroll
 * frame is arithmetic and nothing else. Reading getBoundingClientRect for
 * every item of every group on every frame - which is what this did at first -
 * is dozens of forced layouts a second on the device least able to afford
 * them.
 */
export default function TouchFocus() {
  useEffect(() => {
    // Not "is this a small screen": a laptop at a narrow window still has a
    // pointer and should keep using it. This asks the real question.
    const mq = window.matchMedia("(hover: none)");
    let frame = 0;
    let remeasure = 0;
    let groups: Group[] = [];
    let live = false;

    const clear = (g: Group) => {
      for (const it of g.items) {
        delete it.el.dataset.near;
        it.card.removeAttribute("data-near");
        it.el.style.removeProperty("--dist");
      }
    };

    /** Document-relative geometry, taken once rather than every frame. */
    const measure = () => {
      remeasure = 0;
      const sy = window.scrollY;
      groups = Array.from(document.querySelectorAll<HTMLElement>("[data-focus-group]")).map(
        (g) => {
          const box = g.getBoundingClientRect();
          const items = (Array.from(g.children) as HTMLElement[]).map((el) => {
            const b = el.getBoundingClientRect();
            return {
              el,
              card: el.querySelector<HTMLElement>(".group") ?? el,
              mid: b.top + sy + b.height / 2,
              h: b.height || 1,
            };
          });
          return { items, top: box.top + sy, bottom: box.bottom + sy };
        },
      );
    };

    const paint = () => {
      frame = 0;
      const view = window.innerHeight;
      const mid = window.scrollY + view / 2;

      for (const g of groups) {
        // Off screen: drop the focus entirely, so nothing is left lit behind.
        if (g.bottom < mid - view || g.top > mid + view) {
          clear(g);
          continue;
        }

        let best = 0;
        for (let i = 1; i < g.items.length; i++) {
          if (Math.abs(g.items[i].mid - mid) < Math.abs(g.items[best].mid - mid)) best = i;
        }
        const bestMid = g.items[best].mid;

        for (const it of g.items) {
          // Whole rows light together: items in a grid row share a vertical
          // centre, and lighting one of a pair would look like a fault.
          const near = Math.abs(it.mid - bestMid) < 8;
          if (near) {
            it.el.dataset.near = "true";
            it.card.setAttribute("data-near", "true");
          } else {
            delete it.el.dataset.near;
            it.card.removeAttribute("data-near");
          }
          // Continuous, in the item's own heights - stepping per row index
          // makes the list sit still and then jump as each boundary is
          // crossed, which reads as choppy rather than as a gradient.
          const d = Math.min(FALLOFF, Math.abs(it.mid - mid) / it.h);
          it.el.style.setProperty("--dist", d.toFixed(2));
        }
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onResize = () => {
      if (!remeasure) remeasure = requestAnimationFrame(() => (measure(), paint()));
    };

    // Images finishing and reveals running both change heights under us.
    const ro = new ResizeObserver(onResize);

    const enable = () => {
      if (live) return;
      live = true;
      measure();
      document.documentElement.dataset.touchFocus = "true";
      paint();
      for (const g of groups) if (g.items[0]) ro.observe(g.items[0].el.parentElement!);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
    };
    const disable = () => {
      if (!live) return;
      live = false;
      delete document.documentElement.dataset.touchFocus;
      for (const g of groups) clear(g);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };

    const sync = () => (mq.matches ? enable() : disable());
    sync();
    // A tablet switching between its own screen and a mouse counts here.
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      disable();
      if (frame) cancelAnimationFrame(frame);
      if (remeasure) cancelAnimationFrame(remeasure);
    };
  }, []);

  return null;
}
