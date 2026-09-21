"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";

/**
 * The BX monogram, traced from the illuminated sign on the gym wall.
 *
 * It is built the way the original is: a head, a ring and two diagonals, with
 * one diagonal band masked out of the shapes behind it. That mask is what
 * gives the ring its two flat terminals and the flat on the head - all of
 * them cut parallel to the long diagonal.
 */
export function Mark({ className = "h-9 w-9" }: { className?: string }) {
  // Two Marks render per page (header and footer), so the mask needs its own id.
  const maskId = `bx-mark-${useId()}`;

  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <mask id={maskId}>
          <rect width="100" height="100" fill="#fff" />
          <path
            d="M -6 109 L 112 4"
            stroke="#000"
            strokeWidth="21"
            strokeLinecap="butt"
          />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`} fill="none" stroke="currentColor">
        {/* head */}
        <circle cx="65.2" cy="16.9" r="16.9" fill="currentColor" stroke="none" />
        {/* the ring, open where the diagonal passes through */}
        <path d="M 28.3 76.9 A 19 19 0 1 1 44.5 62.3" strokeWidth="13" />
      </g>

      <g fill="none" stroke="currentColor" strokeLinecap="butt">
        <path d="M 10.9 92.7 L 95.5 16.9" strokeWidth="14.2" />
        <path d="M 64.1 73.4 L 91.0 93.8" strokeWidth="14.2" />
      </g>
    </svg>
  );
}

/**
 * Wordmark plus mark. Clicking it returns to the top of the page rather than
 * re-requesting "/", which on a single-page site would otherwise do nothing
 * visible once you are partway down.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  function toTop(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let people open the home page in a new tab if they mean to.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });

    // Drop the hash so the URL matches where we actually are.
    if (window.location.hash) router.replace("/", { scroll: false });
  }

  return (
    <Link
      href="/"
      onClick={toTop}
      aria-label="BX Fitness Hub - back to top"
      className="group flex items-center gap-2.5 text-white"
    >
      <Mark className="h-9 w-9 shrink-0 transition-colors duration-300 group-hover:text-lime" />
      {!compact && (
        <span className="leading-none">
          <span className="font-display block text-[0.92rem] tracking-tight">BX</span>
          <span className="font-display block text-[0.92rem] tracking-tight">
            Fitness Hub
          </span>
        </span>
      )}
    </Link>
  );
}
