import Link from "next/link";

/**
 * The staff pages render without the site's navigation, so without this there
 * is no way out of them except the browser's back button.
 */
export default function BackToSite({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 text-xs tracking-[0.1em] text-grey-dim uppercase transition-colors hover:text-lime ${className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9.5 3.5 5 8l4.5 4.5" />
      </svg>
      Back to the site
    </Link>
  );
}
