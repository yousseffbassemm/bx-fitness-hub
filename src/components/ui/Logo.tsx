"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const MARK = "/images/logo-mark.png";

/**
 * The BX monogram, from the artwork BX supplied (public/images/logo-mark.png).
 *
 * It is painted as a CSS mask rather than an <img>, because the file is a
 * white-on-transparent alpha mask - which means its silhouette can be filled
 * with currentColor. The mark therefore takes the colour of whatever it sits
 * in, and can change colour on hover, exactly as the old hand-drawn SVG did,
 * while being pixel-accurate to the real logo.
 */
export function Mark({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block shrink-0 bg-current`}
      style={{
        maskImage: `url(${MARK})`,
        WebkitMaskImage: `url(${MARK})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
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
      <Mark className="h-11 w-11 transition-colors duration-300 group-hover:text-lime sm:h-12 sm:w-12" />
      {!compact && (
        <span className="leading-none">
          <span className="font-display block text-[1.05rem] leading-[1.05] tracking-tight">
            BX
          </span>
          <span className="font-display block text-[1.05rem] leading-[1.05] tracking-tight">
            Fitness Hub
          </span>
        </span>
      )}
    </Link>
  );
}
