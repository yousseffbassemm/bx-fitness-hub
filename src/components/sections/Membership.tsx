import { plans } from "@/lib/site";
import PlanDeck from "../PlanDeck";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="mt-[3px] h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path
        d="M3 8.5 6.2 11.7 13 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
      />
    </svg>
  );
}

export default function Membership() {
  return (
    <section
      id="membership"
      className="swell relative py-11 sm:py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <SectionHead
          kicker="Membership"
          title="Three ways"
          accent="to join."
          copy="Every membership covers the full floor, the studios and the timetable."
          align="center"
        />

        {/* Opens on whichever plan is marked featured - the year - so the card
            worth seeing is the one in the middle of the screen. */}
        {/*
          One Reveal around the whole deck, not one per card.
          Per card, the two that start off to the left and right are outside
          the viewport horizontally, so the observer never sees them intersect
          and they sit at opacity 0 until you happen to swipe to them - which
          looked like a deck with one card in it and two missing.
        */}
        <Reveal variant="scale">
          <PlanDeck focus={Math.max(0, plans.findIndex((p) => p.featured))}>
            {plans.map((p) => (
              <div key={p.name} className="h-full">
              <article
                className={`surface relative flex h-full flex-col rounded-md p-6 sm:p-8 lg:p-10 ${
                  p.featured ? "surface-featured" : ""
                }`}
              >
                {p.featured && (
                  <span className="font-display absolute right-0 top-0 bg-lime px-3 py-1.5 text-[0.65rem] tracking-[0.14em] text-ink">
                    Most popular
                  </span>
                )}

                <h3 className="font-display text-2xl text-white">{p.name}</h3>
                <p className="mt-1.5 text-sm text-grey">{p.blurb}</p>

                <p className="mt-5 flex items-baseline gap-2 sm:mt-7">
                  <span
                    className={`font-display text-3xl lg:text-4xl ${
                      p.featured ? "text-lime" : "text-white"
                    }`}
                  >
                    {p.price}
                  </span>
                  <span className="text-xs text-grey-dim">{p.period}</span>
                </p>

                <ul className="mt-6 flex-1 space-y-2.5 border-t border-line pt-6 sm:mt-8 sm:space-y-3.5 sm:pt-8">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex gap-3 text-sm text-grey">
                      <span className={p.featured ? "text-lime" : "text-grey-dim"}>
                        <Tick />
                      </span>
                      {perk}
                    </li>
                  ))}
                </ul>

                <a
                  href="#contact"
                  className={`font-display mt-7 block rounded-sm py-3.5 sm:mt-9 text-center text-[0.8rem] tracking-[0.12em] transition-colors ${
                    p.featured
                      ? "bg-lime text-ink hover:bg-white"
                      : "border border-white/15 text-white hover:border-lime hover:text-lime"
                  }`}
                >
                  Join Now
                </a>
              </article>
              </div>
            ))}
          </PlanDeck>
        </Reveal>

        <Reveal>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-grey-dim">
            BX does not publish prices online &mdash; they are quoted on request.
            The three figures above are placeholders; replace
            <code className="mx-1 text-grey">[MONTHLY PRICE]</code>,
            <code className="mx-1 text-grey">[ANNUAL PRICE]</code> and
            <code className="mx-1 text-grey">[COUPLES PRICE]</code> in
            <code className="mx-1 text-grey">src/lib/site.ts</code>. The listed
            benefits are the real ones.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
