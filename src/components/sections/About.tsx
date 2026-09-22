import Image from "next/image";
import studioYoga from "@/images/studio-yoga.jpg";
import weightsFloor from "@/images/weights-floor.jpg";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

export default function About() {
  return (
    <section id="about" className="bloom-amber relative overflow-hidden py-11 sm:py-16 lg:py-24">
      {/*
        On a phone the photograph is the section rather than a plate stacked
        on top of the words. Full width, a whole column of the page tall and
        cropped to nothing in particular, it read as an offcut; behind the
        type it reads as the room the type is talking about. The plate comes
        back at lg, where there is a column to put it in.
      */}
      <div aria-hidden="true" className="absolute inset-0 lg:hidden">
        <Image
          src={weightsFloor}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Heavy enough that body copy over it stays comfortably readable. */}
        <div className="absolute inset-0 bg-ink/[0.88]" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-transparent to-ink" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-9 sm:gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          {/* Stacked plates - lg only; below that the photograph is the
              section background above. */}
          <Reveal variant="left" className="relative hidden lg:block">
            <div className="relative aspect-[4/3] w-full sm:aspect-[3/4]">
              <Image
                src={weightsFloor}
                alt="The strength floor at BX, benches and cable machines under warm cove lighting"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="plate object-cover"
              />
            </div>
            {/* Square frame over a tall photograph, so the crop is pulled
                down onto the figure rather than the window above her. */}
            <div className="absolute -bottom-10 -right-4 hidden aspect-square w-40 border-4 border-ink sm:block lg:-right-10 lg:w-52">
              <Image
                src={studioYoga}
                alt="A member moving through a yoga flow in the daylit studio at BX"
                fill
                sizes="(max-width: 1024px) 160px, 208px"
                className="plate object-cover object-[50%_62%]"
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

            <ul data-focus-group className="mt-12 grid gap-4 sm:grid-cols-2">
              {[
                ["01", "Performance floor", "Racks, platforms, plate-loaded and cable"],
                ["02", "Movement studios", "Pilates, yoga, dance, boxing, cycling"],
                ["03", "Recovery in-house", "BX Spa, physiotherapy, InBody testing"],
                ["04", "EightyEight kitchen", "Real food, on site, after your session"],
              ].map(([n, title, copy], i) => (
                <Reveal as="li" key={title} delay={90 + i * 70}>
                  <article className="surface group relative h-full overflow-hidden rounded-md p-6">
                    {/* lime rule that runs along the top edge on hover */}
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 h-px w-0 bg-lime transition-all duration-500 group-hover:w-full group-data-[near=true]:w-full"
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
