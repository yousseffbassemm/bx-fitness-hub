import { reasons } from "@/lib/site";
import ReasonList from "../ReasonList";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

/**
 * Numbered list rather than an icon grid - the numbers carry the rhythm and
 * nothing here needs a pictogram to be understood.
 */
export default function Why() {
  return (
    <section className="bloom-lime swell relative py-11 sm:py-16 lg:py-24">
      <div className="relative mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-9 sm:gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHead
              kicker="Why BX"
              title="Six reasons"
              accent="people stay."
              copy="No contracts to decode and no sales floor. Just a gym that works."
            />
          </div>

          {/*
            Blur radiates from the row under the pointer - see ReasonList.
          */}
          <ReasonList>
            {reasons.map((r, i) => (
              <Reveal
                as="li"
                key={r.kicker}
                delay={i * 60}
              >
                <div className="grid grid-cols-[3rem_1fr] gap-5 py-7 sm:grid-cols-[4rem_1fr]">
                  <span className="font-display text-lg text-lime">{r.kicker}</span>
                  <div>
                    <h3 className="font-display text-xl text-white sm:text-2xl">{r.title}</h3>
                    <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-grey">{r.copy}</p>
                  </div>
                </div>
                {i < reasons.length - 1 && <div className="rule-fade" aria-hidden="true" />}
              </Reveal>
            ))}
          </ReasonList>
        </div>
      </div>
    </section>
  );
}
