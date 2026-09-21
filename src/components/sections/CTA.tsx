import Image from "next/image";
import { site } from "@/lib/site";
import { Button } from "../ui/Button";
import Reveal from "../ui/Reveal";

export default function CTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/images/strength-zone.jpg"
          alt=""
          aria-hidden="true"
          fill
          loading="lazy"
          sizes="100vw"
          className="plate object-cover object-center"
        />
        <div className="absolute inset-0 bg-ink/82" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-28 text-center lg:py-36">
        <Reveal>
          <div className="flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-lime" />
            <span className="kicker">Ready when you are</span>
            <span className="h-px w-8 bg-lime" />
          </div>

          <h2 className="font-display mt-7 text-[2.75rem] leading-[0.9] sm:text-6xl lg:text-7xl">
            Show up. Lock in.
            <br />
            <span className="text-lime">Go beyond.</span>
          </h2>

          <p className="mx-auto mt-7 max-w-lg text-[1rem] leading-relaxed text-grey">
            Come in for a free trial session and see the floor for yourself.
            No sales pitch, no contract to sign on the day.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button href="#membership">Join Now</Button>
            <Button href={site.whatsapp.href} variant="outline">
              Book a Free Trial
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
