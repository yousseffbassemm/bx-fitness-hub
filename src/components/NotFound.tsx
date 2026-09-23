"use client";

import { usePathname } from "next/navigation";
import { site } from "@/lib/site";
import { Button } from "./ui/Button";

/**
 * What a reader gets when the address does not lead anywhere.
 *
 * Next's own 404 is a system-font "This page could not be found" with
 * nothing to click, which is a dead end wherever it appears and a
 * particularly bad one on a booking link: /b/<token> 404s whenever the
 * link was mistyped, truncated by whatever app it was pasted through, or
 * belongs to a booking staff have since removed. A member holding that
 * link needs to know their place might be gone and how to ask - not a
 * developer's error page.
 *
 * So the message is written for whichever of those it is. The path is the
 * only thing that distinguishes them.
 */
export default function NotFound() {
  const booking = usePathname().startsWith("/b/");

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-24">
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-lime" />
        <span className="kicker">{booking ? "Booking not found" : "Page not found"}</span>
      </div>

      <h1 className="font-display mt-6 text-4xl leading-tight text-white">
        {booking ? (
          <>
            We can&rsquo;t find that <span className="text-lime">place.</span>
          </>
        ) : (
          <>
            That page isn&rsquo;t <span className="text-lime">here.</span>
          </>
        )}
      </h1>

      <p className="mt-5 text-sm leading-relaxed text-grey">
        {booking ? (
          <>
            The link may have been cut short somewhere along the way, or the
            place may already have been given up. If you think it is still
            yours, call us &mdash; we can find any booking by phone number.
          </>
        ) : (
          <>
            The address may be out of date, or mistyped. Everything the gym
            does is on one page.
          </>
        )}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/#classes">See the timetable</Button>
        {booking ? (
          <Button href={site.phone.href} variant="outline">
            Call {site.phone.display}
          </Button>
        ) : (
          <Button href="/" variant="outline">
            Back to the start
          </Button>
        )}
      </div>
    </section>
  );
}
