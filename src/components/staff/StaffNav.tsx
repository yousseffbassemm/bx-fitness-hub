"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  /** Shown as a count beside the label. Omitted when there is nothing waiting. */
  badge?: number;
};

/**
 * The staff area's own chrome.
 *
 * Two rows, because they answer two different questions. The top one is
 * "where am I and who am I signed in as", which never changes while you work.
 * The second is "what am I working on", which is the only thing that moves.
 * Running them together into one bar made a row of six identical outlined
 * buttons where the section you were on looked like the button that would
 * take you somewhere else.
 *
 * The lime underline is the site's own marker - the same rule that runs down
 * the edge of the posters - rather than a filled pill, which would fight the
 * Join button for the one loud thing on screen.
 */
export default function StaffNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Staff sections" className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((item) => {
        // /staff must not light up for /staff/coaches.
        const active =
          item.href === "/staff" ? pathname === "/staff" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`font-display relative shrink-0 border-b-2 px-4 py-3 text-[0.72rem] tracking-[0.12em] whitespace-nowrap transition-colors ${
              active
                ? "border-lime text-white"
                : "border-transparent text-grey-dim hover:text-white"
            }`}
          >
            {item.label}
            {item.badge ? (
              <span className="ml-2 rounded-full bg-lime px-1.5 py-0.5 text-[0.6rem] text-ink tabular-nums">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
