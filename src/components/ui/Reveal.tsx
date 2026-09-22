"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

export type RevealVariant = "up" | "down" | "left" | "right" | "scale" | "fade";

/**
 * One observer for the whole page rather than one per element. With well over
 * a hundred revealed blocks, a per-element observer is a lot of duplicated
 * bookkeeping for the browser to redo on every scroll.
 */
let shared: IntersectionObserver | null = null;

/**
 * Blocks still waiting to be revealed.
 *
 * The observer ignores the bottom slice of the viewport, so a block animates
 * once it is properly on screen rather than finishing before anyone looks at
 * it. That has a sharp edge: anything that only ever sits inside that slice -
 * the last row of the footer, on a short final screen - never intersects, so
 * it never reveals and simply stays invisible. That is what kept the footer's
 * legal row, and the staff link in it, permanently hidden.
 *
 * So pending blocks are tracked and flushed on reaching the bottom of the
 * page, where there is no scrolling left to trigger them.
 */
const pending = new Set<Element>();

function show(el: Element) {
  (el as HTMLElement).dataset.shown = "true";
  pending.delete(el);
  shared?.unobserve(el);
}

function flushAtBottom() {
  if (!pending.size) return;
  const atBottom =
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  if (atBottom) for (const el of Array.from(pending)) show(el);
}

function observer() {
  if (shared) return shared;

  shared = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) show(entry.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.06 },
  );

  window.addEventListener("scroll", flushAtBottom, { passive: true });
  window.addEventListener("resize", flushAtBottom, { passive: true });
  return shared;
}

/**
 * Fades a block in the first time it enters the viewport, sliding, scaling or
 * unblurring depending on the variant. Anything already on screen animates on
 * load, so the hero arrives the same way the rest of the page does.
 */
export default function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  variant = "up",
  className = "",
  style,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  variant?: RevealVariant;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      el.dataset.shown = "true";
      return;
    }

    const io = observer();
    pending.add(el);
    io.observe(el);
    // A short page may already be sitting at its end on load.
    flushAtBottom();

    return () => {
      pending.delete(el);
      io.unobserve(el);
    };
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${variant} ${className}`}
      style={delay ? { ...style, transitionDelay: `${delay}ms` } : style}
    >
      {children}
    </Tag>
  );
}
