"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Makes deep links like /#membership land in the right place.
 *
 * The browser resolves a hash before the page has finished laying out: the
 * sections use scroll reveals and lazy images, so the document keeps moving
 * underneath the jump and the reader ends up somewhere else entirely. This
 * re-aligns on a short interval until the target stops moving, and gets out
 * of the way the moment the reader scrolls for themselves.
 *
 * Keyed on the path, not just on mount, because coming back from a booking
 * page to /#classes is a client-side navigation: the layout never unmounts,
 * so on mount alone this ran once, on a page with no sections, and never
 * again. Within the home page the hash moves without the path moving, and
 * the browser's own smooth scroll already handles that.
 */
export default function HashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    let target: HTMLElement | null;
    try {
      target = document.querySelector<HTMLElement>(hash);
    } catch {
      return; // not a usable selector
    }
    if (!target) return;

    // Matches scroll-padding-top in globals.css, so the header does not
    // cover the heading we just jumped to.
    const offset = 96;

    // globals.css sets scroll-behavior: smooth, and an explicit
    // behavior: "auto" resolves to that - which meant every tick restarted a
    // smooth scroll and the page never arrived. Jump instantly while we
    // settle, then hand smooth scrolling back.
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    let stableFor = 0;
    let done = false;

    const align = () => {
      if (done || !target) return;
      const wanted = target.getBoundingClientRect().top + window.scrollY - offset;
      if (Math.abs(window.scrollY - wanted) < 2) {
        stableFor += 1;
        if (stableFor >= 2) stop();
        return;
      }
      stableFor = 0;
      window.scrollTo({ top: wanted, behavior: "instant" as ScrollBehavior });
    };

    const onUserScroll = (e: Event) => {
      // Our own scrollTo calls are not trusted events; a real one means the
      // reader has taken over.
      if (e.isTrusted) stop();
    };

    const timer = window.setInterval(align, 120);
    const giveUp = window.setTimeout(stop, 2000);
    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchstart", onUserScroll, { passive: true });
    align();

    function stop() {
      if (done) return;
      done = true;
      root.style.scrollBehavior = previousBehavior;
      clearInterval(timer);
      clearTimeout(giveUp);
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchstart", onUserScroll);
    }

    return stop;
  }, [pathname]);

  return null;
}
