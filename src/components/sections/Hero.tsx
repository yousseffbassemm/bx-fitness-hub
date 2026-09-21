import Image from "next/image";
import { site } from "@/lib/site";
import { Button } from "../ui/Button";

/**
 * Split hero, built to BX's own poster grammar: heavy display type with one
 * line dropped to lime, a thin lime edge marker, and the room itself on the
 * right. On phones the image sits behind the type instead of beside it.
 */
export default function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-ink pt-[4.5rem]">
      <div className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-[1600px] grid-cols-1 items-center gap-12 px-6 pb-28 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:px-12 lg:pb-16">
        {/* Type */}
        <div className="relative">
          {/* the thin lime rule BX puts down the edge of every poster */}
          <span
            aria-hidden="true"
            className="absolute -left-6 top-1 hidden h-32 w-px bg-lime lg:block"
          />

          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-lime" />
            <span className="kicker">New Cairo &middot; Since day one</span>
          </div>

          <h1 className="font-display mt-7 text-[3.35rem] leading-[0.88] sm:text-7xl lg:text-[5.4rem] xl:text-[6.2rem]">
            Where
            <br />
            Movement
            <br />
            <span className="text-lime">Meets Style</span>
          </h1>

          <p className="mt-7 max-w-md text-[1.02rem] leading-relaxed text-grey">
            Built for performance. Made for movement. Designed to push your
            limits &mdash; six in the morning until one at night, every day of
            the week.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button href="#membership">Join Now</Button>
            <Button href={site.whatsapp.href} variant="outline">
              Book a Free Trial
            </Button>
          </div>

          {/* Proof strip */}
          <dl className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-6">
            <div>
              <dt className="kicker">Google</dt>
              <dd className="font-display mt-1.5 text-xl text-white">
                {site.rating.value}
                <span className="text-lime"> &#9733;</span>
                <span className="ml-1.5 text-[0.7rem] tracking-normal text-grey-dim">
                  {site.rating.count} reviews
                </span>
              </dd>
            </div>
            <div>
              <dt className="kicker">Open daily</dt>
              <dd className="font-display mt-1.5 text-xl text-white">6AM &ndash; 1AM</dd>
            </div>
            <div>
              <dt className="kicker">Classes</dt>
              <dd className="font-display mt-1.5 text-xl text-white">
                15 <span className="text-[0.7rem] tracking-normal text-grey-dim">a week</span>
              </dd>
            </div>
          </dl>
        </div>

        {/*
          One image for both layouts: full-bleed behind the type on phones,
          a plate in the right-hand column from lg up. Rendering it once keeps
          the LCP image to a single download.
        */}
        <div className="absolute inset-0 -z-10 lg:relative lg:z-auto lg:h-[76vh]">
          <Image
            src="/images/cardio-rings.jpg"
            alt="The BX Fitness Hub cardio deck at night, lit by circular pendants above the illuminated BX monogram"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="plate object-cover object-[58%_center]"
          />
          {/* Scrim: darkens the whole frame on phones, only the left edge on desktop */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/45 lg:bg-gradient-to-r lg:from-ink/70 lg:via-transparent lg:to-transparent" />
          {/* BX's corner markers */}
          <span
            aria-hidden="true"
            className="absolute -left-px -top-px hidden h-16 w-px bg-lime lg:block"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-px -right-px hidden h-px w-16 bg-lime lg:block"
          />
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 lg:block">
        <span className="kicker text-grey-dim">Scroll</span>
      </div>
    </section>
  );
}
