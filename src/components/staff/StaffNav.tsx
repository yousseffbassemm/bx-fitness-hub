"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

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
  const nav = useRef<HTMLElement>(null);
  const current = useRef<HTMLAnchorElement>(null);

  /*
    Bring the section you are on into view.

    The row is wider than a phone - nine sections against about 450px - so it
    scrolls. It opened at the left every time, which meant that on Facilities,
    Gallery, Pricing, Team and Problems the underline marking where you were
    was somewhere off the right-hand edge: five of the nine sections looked
    like no section at all, and Problems, the one with the badge worth
    noticing, sat furthest out.

    scrollLeft rather than scrollIntoView, which walks up the ancestors and
    would drag the page itself around on the way.

    Measured off the two rectangles rather than offsetLeft: the header is
    sticky, so it - not this row - is what a link's offsetLeft is counted
    from, and the difference left the last section still half off the edge.
  */
  useEffect(() => {
    const row = nav.current;
    const link = current.current;
    if (!row || !link) return;

    const rowBox = row.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    const within = linkBox.left - rowBox.left + row.scrollLeft;

    // Past the ends this asks for more scroll than there is; the browser
    // clamps it, which lands the first and last sections flush where
    // centring them is not possible.
    row.scrollLeft = Math.max(0, within - (row.clientWidth - linkBox.width) / 2);
  }, [pathname]);

  return (
    <nav
      ref={nav}
      aria-label="Staff sections"
      className="-mb-px flex gap-1 overflow-x-auto"
    >
      {items.map((item) => {
        // /staff must not light up for /staff/coaches.
        const active =
          item.href === "/staff" ? pathname === "/staff" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            ref={active ? current : undefined}
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
