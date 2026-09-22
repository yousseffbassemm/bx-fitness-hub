import Image from "next/image";
import { getFacilities } from "@/lib/content";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

/**
 * Deliberately uneven grid - two tall plates, one wide, repeating - so the
 * section reads like a contact sheet rather than a row of equal cards.
 */
export default async function Facilities() {
  const facilities = await getFacilities();

  return (
    <section id="facilities" className="relative py-11 sm:py-11 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <SectionHead
          kicker="Facilities"
          title="Every corner is"
          accent="made to move."
          copy="Six zones under one roof, plus the spa and the kitchen next door."
        />

        <div
          data-focus-group
          className="mt-9 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3"
        >
          {facilities.map((f, i) => (
            <Reveal key={i} variant="scale" delay={(i % 3) * 90}>
              {/*
                Every card is the same box and the photograph fills it
                absolutely, so no card can end up shorter than its grid row and
                leave a strip of background showing under the caption.

                Phones get a landscape crop. Six 4:5 plates at full width is
                nearly 3,500px of scrolling on its own - more than a sixth of
                the page for one section. From sm up the cards sit two and
                three to a row, where the tall crop costs nothing.
              */}
              <article className="surface photo-inset group relative aspect-[3/2] overflow-hidden rounded-md bg-charcoal sm:aspect-[4/5]">
                <div className="absolute inset-0">
                  <Image
                    src={f.photo}
                    alt={f.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    style={{ objectPosition: f.focus }}
                    className="plate object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] group-data-[near=true]:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent" />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <span
                    aria-hidden="true"
                    className="block h-px w-8 bg-lime transition-all duration-500 group-hover:w-16 group-data-[near=true]:w-16"
                  />
                  <h3 className="font-display mt-3 text-xl text-white sm:mt-4 sm:text-2xl">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 max-w-xs text-[0.8rem] leading-relaxed text-grey sm:mt-2 sm:text-sm">
                    {f.copy}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
