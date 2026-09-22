import { reviews, site } from "@/lib/site";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L1.5 7.7l5.9-.9z"
            fill={n <= Math.round(value) ? "var(--bx-lime)" : "var(--bx-line)"}
          />
        </svg>
      ))}
    </span>
  );
}

/** Google's mark, so it is clear where the words came from. */
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
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHead
              kicker="Members"
              title="Rated"
              accent={`${site.rating.value} on Google.`}
            />
            <Reveal delay={80}>
              <div className="mt-7 flex items-center gap-4">
                <Stars value={site.rating.value} />
                <span className="text-sm text-grey">{site.rating.count} reviews</span>
              </div>
              <a
                href={site.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2.5 rounded-sm border border-white/15 px-5 py-3 text-sm text-white transition-colors hover:border-lime hover:text-lime"
              >
                <GoogleG />
                Read them all on Google
              </a>
            </Reveal>
          </div>

          {/*
            The cards drift on their own, each on a different phase and
            duration so the group never pulses in unison. The float is a
            separate element from the reveal, because one animates forever and
            the other runs once - putting both transforms on one node would
            have them fight.
          */}
          <ul className="grid gap-5 sm:grid-cols-2">
            {reviews.map((r, i) => (
              <Reveal
                as="li"
                key={r.name}
                variant="scale"
                delay={i * 130}
                className={i === 2 ? "sm:col-span-2 sm:max-w-xl sm:justify-self-end" : ""}
              >
                <figure
                  className="float-card group h-full rounded-lg border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-7 shadow-[0_24px_60px_-34px_rgba(0,0,0,0.95)] transition-colors duration-500 hover:border-lime/40"
                  style={{ "--float-delay": `${i * 1.4}s`, "--float-time": `${7.5 + i * 1.1}s` } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Stars value={r.rating} />
                    <GoogleG className="h-4 w-4 opacity-70" />
                  </div>

                  <blockquote className="mt-5 text-[0.95rem] leading-relaxed text-white">
                    &ldquo;{r.quote}&rdquo;
                  </blockquote>

                  <figcaption className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                    <span
                      aria-hidden="true"
                      className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime/15 text-xs text-lime"
                    >
                      {r.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-xs text-grey-dim">
                      <span className="font-display block text-[0.8rem] tracking-[0.08em] text-grey">
                        {r.name}
                      </span>
                      {r.when}
                      {r.excerpt && <span className="ml-1.5 text-grey-dim">&middot; excerpt</span>}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal variant="fade">
          <p className="mt-10 text-xs leading-relaxed text-grey-dim">
            Real reviews from the BX Fitness Hub listing on Google Maps, read on
            22 September 2026. Two are excerpts, cut at a sentence because
            Google truncates long reviews in its own interface. They are a
            snapshot &mdash; see the README for wiring the Google Places API so
            they stay current.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
