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
 * bookkeeping for the browser to do on every scroll.
 */
let shared: IntersectionObserver | null = null;

function observer() {
  if (shared) return shared;
  shared = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.shown = "true";
        shared?.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -14% 0px", threshold: 0.08 },
  );
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
    io.observe(el);
    return () => io.unobserve(el);
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
