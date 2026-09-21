import Link from "next/link";
import { nav, site } from "@/lib/site";
import { Logo } from "./ui/Logo";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-ink pb-24 pt-16 md:pb-16">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="font-display mt-6 max-w-xs text-xl leading-tight text-white">
              Where movement
              <br />
              meets <span className="text-lime">style.</span>
            </p>
            <p className="mt-5 text-xs leading-relaxed text-grey-dim">
              {site.address.line1}, {site.address.line2}
              <br />
              {site.address.region}
            </p>
          </div>

          <nav aria-label="Footer">
            <h2 className="kicker">Explore</h2>
            <ul className="mt-5 space-y-3">
              {nav.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-grey transition-colors hover:text-lime"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="kicker">Contact</h2>
            <ul className="mt-5 space-y-3 text-sm text-grey">
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
              <li className="text-grey-dim">{site.email.display}</li>
            </ul>
          </div>

          <div>
            <h2 className="kicker">Hours</h2>
            <p className="mt-5 text-sm text-grey">
              Monday &ndash; Sunday
              <br />
              <span className="font-display text-lg text-white">6AM &ndash; 1AM</span>
            </p>

            <h2 className="kicker mt-8">Follow</h2>
            <ul className="mt-5 space-y-3 text-sm text-grey">
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
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-grey-dim">
            &copy; {year} {site.name}. All rights reserved.
          </p>
          <ul className="flex gap-6 text-xs text-grey-dim">
            {/* TODO: add the real policy pages before launch */}
            <li>
              <span className="cursor-not-allowed">Privacy Policy [TODO]</span>
            </li>
            <li>
              <span className="cursor-not-allowed">Terms [TODO]</span>
            </li>
            <li>
              {/*
                For the front desk. Password-protected and noindex, so it is
                unobtrusive rather than hidden - the password is the security,
                not the obscurity.
              */}
              <Link
                href="/staff"
                className="transition-colors hover:text-grey"
              >
                Staff
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
