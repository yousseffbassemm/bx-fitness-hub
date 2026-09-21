import Image from "next/image";
import { facilities } from "@/lib/site";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

/**
 * Deliberately uneven grid - two tall plates, one wide, repeating - so the
 * section reads like a contact sheet rather than a row of equal cards.
 */
export default function Facilities() {
  return (
    <section id="facilities" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <SectionHead
          kicker="Facilities"
          title="Every corner is"
          accent="made to move."
          copy="Six zones under one roof, plus the spa and the kitchen next door."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((f, i) => (
            <Reveal
              key={f.title}
              delay={(i % 3) * 90}
              className={f.span === "wide" ? "sm:col-span-2 lg:col-span-1" : ""}
            >
              <article className="group relative h-full overflow-hidden bg-charcoal">
                <div
                  className={`relative w-full ${
                    f.span === "wide" ? "aspect-[4/3]" : "aspect-[3/4]"
                  }`}
                >
                  <Image
                    src={f.image}
                    alt={f.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="plate object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-6">
                  <span
                    aria-hidden="true"
                    className="block h-px w-8 bg-lime transition-all duration-500 group-hover:w-16"
                  />
                  <h3 className="font-display mt-4 text-2xl text-white">{f.title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-grey">{f.copy}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
