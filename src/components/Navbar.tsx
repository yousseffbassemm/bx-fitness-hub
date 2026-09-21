"use client";

import { useEffect, useState } from "react";
import { nav, site } from "@/lib/site";
import { Logo } from "./ui/Logo";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page behind the mobile sheet.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-white/10 bg-ink/55 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.9)] backdrop-blur-2xl backdrop-saturate-150"
          : "border-b border-transparent bg-transparent backdrop-blur-0"
      }`}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-[4.5rem] max-w-[1600px] items-center justify-between gap-6 px-6 lg:px-12"
      >
        <span onClick={() => setOpen(false)}>
          <Logo />
        </span>

        <ul className="hidden items-center gap-7 xl:flex">
          {nav.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="text-[0.82rem] text-grey transition-colors hover:text-white"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a
            href="#contact"
            className="hidden text-[0.82rem] text-grey transition-colors hover:text-white lg:block"
          >
            Book a free trial
          </a>
          <a
            href="#membership"
            className="font-display hidden rounded-sm bg-lime px-5 py-2.5 text-[0.78rem] tracking-[0.12em] text-ink transition-colors hover:bg-white sm:inline-flex"
          >
            Join Now
          </a>

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="bx-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-10 w-10 items-center justify-center border border-line xl:hidden"
          >
            <span className="relative block h-3 w-4">
              <span
                className={`absolute left-0 h-[1.5px] w-4 bg-white transition-all duration-300 ${
                  open ? "top-1.5 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 h-[1.5px] w-4 bg-white transition-opacity duration-200 ${
                  open ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 h-[1.5px] w-4 bg-white transition-all duration-300 ${
                  open ? "top-1.5 -rotate-45" : "top-3"
                }`}
              />
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      <div
        id="bx-menu"
        hidden={!open}
        className="border-t border-line bg-ink xl:hidden"
      >
        <ul className="px-6 py-2">
          {nav.map((item) => (
            <li key={item.href} className="border-b border-line/60 last:border-0">
              <a
                href={item.href}
                onClick={() => setOpen(false)}
                className="font-display block py-4 text-xl text-white"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex gap-3 px-6 pb-6 pt-2">
          <a
            href="#membership"
            onClick={() => setOpen(false)}
            className="font-display flex-1 rounded-sm bg-lime py-3.5 text-center text-[0.8rem] tracking-[0.12em] text-ink"
          >
            Join Now
          </a>
          <a
            href={site.phone.href}
            className="font-display flex-1 rounded-sm border border-white/15 py-3.5 text-center text-[0.8rem] tracking-[0.12em] text-white"
          >
            Call
          </a>
        </div>
      </div>
    </header>
  );
}
