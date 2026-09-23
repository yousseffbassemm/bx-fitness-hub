import Link from "next/link";
import { isPlaceholder, nav, site } from "@/lib/site";
import Reveal from "./ui/Reveal";
import { Logo } from "./ui/Logo";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-ink pb-20 pt-10 sm:pt-16 md:pb-16">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        {/*
            Two columns on a phone. Stacked, these four blocks ran to most of a
            screen on their own - the lists are short enough to sit beside each
            other, and the brand block keeps the full width above them.
          */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <Reveal className="col-span-2 lg:col-span-1">
            <Logo />
            <p className="font-display mt-4 max-w-xs text-lg leading-tight text-white sm:mt-6 sm:text-xl">
              Where movement
              <br />
              meets <span className="text-lime">style.</span>
            </p>
            <p className="mt-3 text-xs leading-relaxed text-grey-dim sm:mt-5">
              {site.address.line1}, {site.address.line2}
              <br />
              {site.address.region}
            </p>
          </Reveal>

          <Reveal as="nav" delay={90} aria-label="Footer" className="col-span-2 lg:col-span-1">
            <h2 className="kicker">Explore</h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:mt-5 lg:block lg:space-y-3">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-grey transition-colors hover:text-lime"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={180}>
            <h2 className="kicker">Contact</h2>
            <ul className="mt-4 space-y-2 text-sm text-grey sm:mt-5 sm:space-y-3">
              <li>
                <a href={site.phone.href} className="transition-colors hover:text-lime">
                  {site.phone.display}
                </a>
                <span className="ml-2 text-xs text-grey-dim">Gym</span>
              </li>
              <li>
                <a href={site.spa.href} className="transition-colors hover:text-lime">
                  {site.spa.display}
                </a>
                <span className="ml-2 text-xs text-grey-dim">Spa</span>
              </li>
              {/* Left out until BX gives us one, rather than printing the
                  stand-in at visitors. */}
              {!isPlaceholder(site.email.display) && (
                <li className="text-grey-dim">{site.email.display}</li>
              )}
            </ul>
          </Reveal>

          <Reveal delay={270}>
            <h2 className="kicker">Hours</h2>
            <p className="mt-4 text-sm text-grey sm:mt-5">
              Monday &ndash; Sunday
              <br />
              <span className="font-display text-lg text-white">6AM &ndash; 1AM</span>
            </p>

            <h2 className="kicker mt-6 sm:mt-8">Follow</h2>
            <ul className="mt-4 space-y-2 text-sm text-grey sm:mt-5 sm:space-y-3">
              <li>
                <a
                  href={site.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-lime"
                >
                  @bx_fitnesshub
                </a>
              </li>
              <li>
                <a
                  href={site.social.spa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-lime"
                >
                  @bx_spa
                </a>
              </li>
              <li>
                <a
                  href={site.social.cafe}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-lime"
                >
                  @eightyeight.daily
                </a>
              </li>
            </ul>
          </Reveal>
        </div>

        <Reveal
          variant="fade"
          delay={360}
          className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-7"
        >
          <p className="text-xs text-grey-dim">
            &copy; {year} {site.name}. All rights reserved.
          </p>
          <ul className="flex gap-6 text-xs text-grey-dim">
            {/*
              A Privacy Policy and Terms belong here, and this is not the
              place they get written: they are BX's to give, and inventing
              them would be inventing a promise on their behalf. What was
              here read "Privacy Policy [TODO]" and "Terms [TODO]" in the
              footer of the live site - a dead link that says the site is
              unfinished is worse than no link, so nothing shows until there
              is a real page to point at.
            */}
            <li>
              {/*
                For the front desk. Password-protected and noindex, so it is
                unobtrusive rather than hidden - the password is the security,
                not the obscurity.
              */}
              <Link
                href="/staff"
                className="inline-flex items-center gap-1.5 text-grey transition-colors hover:text-lime"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" />
                  <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                </svg>
                Staff login
              </Link>
            </li>
          </ul>
        </Reveal>
      </div>
    </footer>
  );
}
