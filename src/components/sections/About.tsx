import Image from "next/image";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

export default function About() {
  return (
    <section id="about" className="bloom-amber relative overflow-hidden py-16 lg:py-24">
      <div className="relative mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          {/* Stacked plates */}
          <Reveal className="relative">
            <div className="relative aspect-[3/4] w-full">
              <Image
                src="/images/weights-floor.jpg"
                alt="The strength floor at BX, benches and cable machines under warm cove lighting"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="plate object-cover"
              />
            </div>
            <div className="absolute -bottom-10 -right-4 hidden aspect-square w-40 border-4 border-ink sm:block lg:-right-10 lg:w-52">
              <Image
                src="/images/studio-bright.jpg"
                alt="Daylight in the mirrored movement studio"
                fill
                sizes="200px"
                className="plate object-cover"
              />
            </div>
          </Reveal>

          <div>
            <SectionHead
              kicker="The place"
              title="This isn't just a gym."
              accent="It's the room."
              copy="Every rep gets heavier, every session gets stronger, and every corner is built to push you forward. Dark stone and warm light on the training floors. Oak, mirrors and daylight in the studios. Show up, lock in, go beyond."
            />

            <ul className="mt-12 grid gap-4 sm:grid-cols-2">
              {[
                ["01", "Performance floor", "Racks, platforms, plate-loaded and cable"],
                ["02", "Movement studios", "Pilates, yoga, dance, boxing, cycling"],
                ["03", "Recovery in-house", "BX Spa, physiotherapy, InBody testing"],
                ["04", "EightyEight kitchen", "Real food, on site, after your session"],
              ].map(([n, title, copy], i) => (
                <Reveal as="li" key={title} delay={90 + i * 70}>
                  <article className="group relative h-full overflow-hidden rounded-sm border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] transition-all duration-500 hover:-translate-y-1 hover:border-lime/45 hover:shadow-[0_26px_60px_-30px_rgba(199,236,30,0.3)]">
                    {/* lime rule that runs along the top edge on hover */}
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 h-px w-0 bg-lime transition-all duration-500 group-hover:w-full"
                    />
                    <span className="font-display text-xs tracking-[0.18em] text-lime">{n}</span>
                    <h3 className="font-display mt-3 text-lg leading-tight text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-grey">{copy}</p>
                  </article>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
