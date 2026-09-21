import Image from "next/image";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

export default function About() {
  return (
    <section id="about" className="bloom-amber relative overflow-hidden py-24 lg:py-32">
      <div className="relative mx-auto max-w-7xl px-5 lg:px-10">
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

            <Reveal delay={90}>
              <ul className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2">
                {[
                  ["Performance floor", "Racks, platforms, plate-loaded and cable"],
                  ["Movement studios", "Pilates, yoga, dance, boxing, cycling"],
                  ["Recovery in-house", "BX Spa, physiotherapy, InBody testing"],
                  ["EightyEight kitchen", "Real food, on site, after your session"],
                ].map(([title, copy]) => (
                  <li key={title} className="bg-charcoal p-6">
                    <h3 className="font-display text-base text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-grey">{copy}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
