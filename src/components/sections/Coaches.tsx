import Image from "next/image";
import { coaches } from "@/lib/site";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Coach portraits have not been supplied, so the cards letter the name
 * instead of borrowing a stock face. Add `photo` to a coach in site.ts and
 * that card switches to the photograph automatically.
 */
export default function Coaches() {
  return (
    <section id="coaches" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        <SectionHead
          kicker="The team"
          title="Eleven coaches."
          accent="Twelve disciplines."
          copy="Everyone on this list teaches on the current timetable."
        />

        <ul className="mt-14 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-4">
          {coaches.map((c, i) => (
            <Reveal as="li" key={c.name} delay={(i % 4) * 70}>
              <article className="group relative h-full bg-ink">
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-charcoal">
                  {c.photo ? (
                    <Image
                      src={c.photo}
                      alt={`${c.name}, coach at BX Fitness Hub`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="plate object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        aria-hidden="true"
                        className="font-display text-6xl text-line transition-colors duration-500 group-hover:text-lime/30"
                      >
                        {initials(c.name)}
                      </span>
                    </div>
                  )}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 h-px w-0 bg-lime transition-all duration-500 group-hover:w-full"
                  />
                </div>

                <div className="p-5">
                  <h3 className="font-display text-base leading-tight text-white">{c.name}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-grey">
                    {c.disciplines.join(" · ")}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={80}>
          <p className="mt-6 text-xs text-grey-dim">
            Coach portraits and full bios to be added &mdash; drop a photo into
            <code className="mx-1 text-grey">public/images/coaches/</code> and set
            <code className="mx-1 text-grey">photo</code> on the coach in
            <code className="mx-1 text-grey">src/lib/site.ts</code>.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
