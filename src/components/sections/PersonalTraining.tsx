import Image from "next/image";
import freeWeights from "@/images/free-weights.jpg";
import { Button } from "../ui/Button";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

const steps = [
  {
    n: "01",
    title: "Assessment",
    copy: "InBody composition test and a movement screen, so the plan starts from where you actually are.",
  },
  {
    n: "02",
    title: "Your programme",
    copy: "Built around your goal and your week - not a template handed to everyone on the floor.",
  },
  {
    n: "03",
    title: "Nutrition",
    copy: "A nutrition session to make the food side workable, with EightyEight downstairs.",
  },
  {
    n: "04",
    title: "Re-test",
    copy: "Ten InBody tests across the year. Progress you can see rather than guess at.",
  },
];

export default function PersonalTraining() {
  return (
    <section
      id="training"
      className="bloom-amber swell relative py-16 lg:py-24"
    >
      <div className="relative mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHead
              kicker="Personal training"
              title="Train with"
              accent="intent."
              copy="Focused movement, strong results. One coach, your programme, and a number at the end of it that proves the work happened."
            />

            <Reveal delay={80}>
              <ol className="mt-10">
                {steps.map((s) => (
                  <li
                    key={s.n}
                    className="grid grid-cols-[2.5rem_1fr] gap-5 border-b border-line py-6 first:border-t"
                  >
                    <span className="font-display text-sm text-lime">{s.n}</span>
                    <div>
                      <h3 className="font-display text-lg text-white">{s.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-grey">{s.copy}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>

            <Reveal delay={140} className="mt-9 flex flex-wrap gap-3">
              <Button href="#coaches">Meet Our Coaches</Button>
              <Button href="#contact" variant="outline">
                Ask about PT
              </Button>
            </Reveal>
          </div>

          <Reveal delay={60} className="relative">
            <div className="relative aspect-[4/5] w-full lg:sticky lg:top-28">
              <Image
                src={freeWeights}
                alt="The free-weights floor at BX under angular LED frames"
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="plate object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
              <span aria-hidden="true" className="absolute -right-px -top-px h-16 w-px bg-lime" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
