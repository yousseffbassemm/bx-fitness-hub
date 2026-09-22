import { reviews, site } from "@/lib/site";
import ReviewCarousel from "../ReviewCarousel";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
          <path
            d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L1.5 7.7l5.9-.9z"
            fill={n <= Math.round(value) ? "var(--bx-lime)" : "var(--bx-line)"}
          />
        </svg>
      ))}
    </span>
  );
}

function GoogleG({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C7.9 41 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.4A13.3 13.3 0 0 1 10.8 24c0-1.5.3-3 .7-4.4l-7.1-5.6A22 22 0 0 0 2 24c0 3.6.9 6.9 2.4 9.9z" />
      <path fill="#EA4335" d="M24 10.6c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.4 29.9 2 24 2 15.4 2 7.9 7 4.4 14l7.1 5.6c1.8-5.3 6.7-9 12.5-9z" />
    </svg>
  );
}

export default function Testimonials() {
  return (
    <section className="relative py-16 lg:py-24">
      {/* Heading is contained; the deck runs the full width so there are always
          cards falling away on both sides of the one in focus. */}
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHead
            kicker="Members"
            title="Rated"
            accent={`${site.rating.value} on Google.`}
          />
          <Reveal delay={90} variant="right">
            <div className="flex items-center gap-4">
              <Stars value={site.rating.value} />
              <span className="text-sm text-grey">{site.rating.count} reviews</span>
            </div>
            <a
              href={site.maps}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2.5 rounded-sm border border-white/15 px-5 py-3 text-sm text-white transition-colors hover:border-lime hover:text-lime"
            >
              <GoogleG />
              Read them all on Google
            </a>
          </Reveal>
        </div>
      </div>

      <Reveal variant="fade" delay={140} className="mt-12">
        <ReviewCarousel reviews={reviews} />
      </Reveal>

      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <Reveal variant="fade">
          <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-grey-dim">
            Every written review Google shows across BX&apos;s two listings
            &mdash; BX Fitness Hub (4.6 from 76) and BX Spa (4.9 from 35)
            &mdash; read on 22 September 2026. The remaining ratings carry no
            text. Some quotes are excerpts, cut at a sentence, because Google
            truncates long reviews in its own interface. This is a snapshot; see
            the README for wiring the Google Places API so it stays current.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
