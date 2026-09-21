import { site, testimonials } from "@/lib/site";
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

export default function Testimonials() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div>
            <SectionHead kicker="Members" title="Rated" accent={`${site.rating.value} on Google.`} />
            <Reveal delay={70}>
              <div className="mt-7 flex items-center gap-4">
                <Stars value={site.rating.value} />
                <span className="text-sm text-grey">
                  {site.rating.count} reviews
                </span>
              </div>
              <a
                href={site.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-block text-sm text-grey underline underline-offset-4 transition-colors hover:text-lime"
              >
                Read them on Google
              </a>
            </Reveal>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {testimonials.map((t, i) => (
              <Reveal
                as="li"
                key={i}
                delay={i * 80}
                className={i === 2 ? "sm:col-span-2" : ""}
              >
                <figure className="h-full rounded-sm border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-7 transition-colors duration-500 hover:border-white/20">
                  <Stars value={5} />
                  <blockquote className="mt-5 text-[0.95rem] leading-relaxed text-white">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5 border-t border-line pt-4 text-xs text-grey-dim">
                    <span className="font-display text-[0.8rem] tracking-[0.1em] text-grey">
                      {t.name}
                    </span>
                    <span className="mx-2">&middot;</span>
                    {t.detail}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal>
          <p className="mt-8 text-xs text-grey-dim">
            The 4.6 rating and review count are real. The three quotes are
            placeholders &mdash; swap in reviews you have permission to publish,
            with names, in <code className="mx-1 text-grey">src/lib/site.ts</code>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
