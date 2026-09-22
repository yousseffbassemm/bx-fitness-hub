"use client";

import { useEffect } from "react";

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
 * Whole rows light together: in a two-column grid the items in a row share a
 * vertical centre, and picking only one of a pair would look like a mistake.
 */
export default function TouchFocus() {
  useEffect(() => {
    // Not "is this a small screen": a laptop at a narrow window still has a
    // pointer and should keep using it. This asks the real question.
    const mq = window.matchMedia("(hover: none)");
    let frame = 0;
    let groups: HTMLElement[] = [];

    const clear = (items: HTMLElement[]) => {
      for (const it of items) {
        delete it.dataset.near;
        (it.querySelector<HTMLElement>(".group") ?? it).removeAttribute("data-near");
        it.style.removeProperty("--dist");
      }
    };

    const paint = () => {
      frame = 0;
      const mid = window.innerHeight / 2;

      for (const g of groups) {
        const items = Array.from(g.children) as HTMLElement[];
        const box = g.getBoundingClientRect();
        // Off screen: drop the focus entirely, so nothing is left lit behind.
        if (box.bottom < 0 || box.top > window.innerHeight) {
          clear(items);
          continue;
        }

        const boxes = items.map((it) => {
          const b = it.getBoundingClientRect();
          return { mid: b.top + b.height / 2, h: b.height || 1 };
        });
        const centres = boxes.map((b) => b.mid);
        let best = 0;
        for (let i = 1; i < centres.length; i++) {
          if (Math.abs(centres[i] - mid) < Math.abs(centres[best] - mid)) best = i;
        }

        items.forEach((it, i) => {
          // Same row, within rounding - grid rows line up exactly.
          const near = Math.abs(centres[i] - centres[best]) < 8;
          const card = it.querySelector<HTMLElement>(".group") ?? it;
          if (near) {
            it.dataset.near = "true";
            card.setAttribute("data-near", "true");
          } else {
            delete it.dataset.near;
            card.removeAttribute("data-near");
          }
          // How far this one is from the middle of the screen, in its own
          // heights and continuous, for effects that fall off with distance
          // rather than switching on and off. Row index would step: the whole
          // list would sit still and then jump as each boundary was crossed.
          const d = Math.min(4, Math.abs(boxes[i].mid - mid) / boxes[i].h);
          it.style.setProperty("--dist", d.toFixed(3));
        });
      }
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };

    let live = false;
    const enable = () => {
      if (live) return;
      live = true;
      groups = Array.from(document.querySelectorAll<HTMLElement>("[data-focus-group]"));
      document.documentElement.dataset.touchFocus = "true";
      paint();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    };
    const disable = () => {
      if (!live) return;
      live = false;
      delete document.documentElement.dataset.touchFocus;
      for (const g of groups) clear(Array.from(g.children) as HTMLElement[]);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };

    const sync = () => (mq.matches ? enable() : disable());
    sync();
    // A tablet switching between its own screen and a mouse counts here.
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      disable();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
