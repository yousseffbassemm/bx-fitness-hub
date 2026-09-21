import Image from "next/image";
import { coaches } from "@/lib/site";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

/**
 * The personal training team. Class instructors are a separate, larger group
 * and are credited against their own sessions in the timetable.
 */
export default function Coaches() {
  return (
    <section id="coaches" className="relative py-16 lg:py-24">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <SectionHead
          kicker="The team"
          title="Six coaches."
          accent="One to one."
          copy="Certified trainers who build the programme around you. Classes are led by a wider group of instructors, credited on the timetable above."
        />

        <ul className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {coaches.map((c, i) => (
            <Reveal as="li" key={c.name} delay={(i % 6) * 70}>
              <article className="group relative h-full overflow-hidden rounded-sm border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent transition-all duration-500 hover:-translate-y-1 hover:border-lime/40">
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  <Image
                    src={c.photo}
                    alt={`${c.name}, personal trainer at BX Fitness Hub`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
                    className="plate object-cover object-top transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* keeps the tops of the cards reading as one row */}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-transparent to-transparent" />
                </div>

                <div className="p-5">
                  <h3 className="font-display text-base leading-tight text-white">{c.name}</h3>
                  <p className="mt-1.5 text-[0.7rem] leading-snug text-lime">{c.credential}</p>
                  <ul className="mt-3 space-y-1">
                    {c.disciplines.map((d) => (
                      <li key={d} className="text-xs leading-snug text-grey">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>

                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-px w-0 bg-lime transition-all duration-500 group-hover:w-full"
                />
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
