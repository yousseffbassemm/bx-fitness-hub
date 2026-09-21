import { site } from "@/lib/site";
import LeadForm from "../LeadForm";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

const mapSrc = `https://www.google.com/maps?q=${site.coords.lat},${site.coords.lng}&hl=en&z=16&output=embed`;

export default function Contact() {
  return (
    <section
      id="contact"
      className="swell relative py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          {/* Details */}
          <div>
            <SectionHead
              kicker="Find us"
              title="New Cairo."
              accent="Open till 1AM."
              copy="Come by, call, or send a message. Whichever is easiest."
            />

            <Reveal delay={70}>
              <dl className="mt-10 divide-y divide-line border-y border-line">
                <div className="grid grid-cols-[6.5rem_1fr] gap-4 py-5">
                  <dt className="kicker pt-1">Address</dt>
                  <dd className="text-sm leading-relaxed text-white">
                    {site.address.street}
                    <br />
                    {site.address.line1}, {site.address.line2}
                    <br />
                    {site.address.region}
                  </dd>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-4 py-5">
                  <dt className="kicker pt-1">Hours</dt>
                  <dd className="text-sm text-white">{site.hours.display}</dd>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-4 py-5">
                  <dt className="kicker pt-1">Gym</dt>
                  <dd className="text-sm text-white">
                    <a href={site.phone.href} className="hover:text-lime">
                      {site.phone.display}
                    </a>
                  </dd>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-4 py-5">
                  <dt className="kicker pt-1">BX Spa</dt>
                  <dd className="text-sm text-white">
                    <a href={site.spa.href} className="hover:text-lime">
                      {site.spa.display}
                    </a>
                  </dd>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-4 py-5">
                  <dt className="kicker pt-1">Email</dt>
                  <dd className="text-sm text-grey">{site.email.display}</dd>
                </div>
              </dl>
            </Reveal>

            <Reveal delay={110} className="mt-8 flex flex-wrap gap-3">
              <a
                href={site.maps}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display rounded-sm border border-white/15 px-5 py-3 text-[0.78rem] tracking-[0.12em] text-white transition-colors hover:border-lime hover:text-lime"
              >
                Get Directions
              </a>
              <a
                href={site.phone.href}
                className="font-display rounded-sm bg-lime px-5 py-3 text-[0.78rem] tracking-[0.12em] text-ink transition-colors hover:bg-white"
              >
                Call Now
              </a>
            </Reveal>

            <Reveal delay={150} className="mt-10">
              <div className="aspect-[16/10] w-full overflow-hidden rounded-sm border border-white/10">
                <iframe
                  src={mapSrc}
                  title={`Map showing ${site.name} in New Cairo`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full w-full grayscale-[0.4] contrast-[1.1]"
                />
              </div>
            </Reveal>
          </div>

          {/* Form */}
          <Reveal delay={60}>
            <div className="rounded-sm border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-7 shadow-[0_30px_70px_-45px_rgba(0,0,0,0.9)] lg:sticky lg:top-28 lg:p-10">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-lime" />
                <span className="kicker">Start here</span>
              </div>
              <h3 className="font-display mt-5 text-3xl text-white lg:text-4xl">
                Tell us your goal.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-grey">
                Leave your details and a coach will call you back to set up a
                free trial session.
              </p>

              <div className="mt-8">
                <LeadForm />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
