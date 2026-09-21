import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-brand-border bg-brand-surface-alt">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h2 className="font-heading text-base font-bold">BX Fitness Hub</h2>
          {/* TODO: one-line description of the gym */}
          <p className="mt-2 text-sm text-brand-muted">
            TODO: short tagline goes here.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-base font-bold">Visit us</h2>
          {/* TODO: real address and opening hours - do not guess these */}
          <p className="mt-2 text-sm text-brand-muted">TODO: street address</p>
          <p className="text-sm text-brand-muted">TODO: opening hours</p>
          <p className="text-sm text-brand-muted">TODO: phone / email</p>
        </div>

        <div>
          <h2 className="font-heading text-base font-bold">Pages</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link href="/classes" className="text-brand-muted hover:text-brand-ink">
                Classes
              </Link>
            </li>
            <li>
              <Link href="/trainers" className="text-brand-muted hover:text-brand-ink">
                Trainers
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-brand-muted hover:text-brand-ink">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/contact" className="text-brand-muted hover:text-brand-ink">
                Contact
              </Link>
            </li>
          </ul>
          {/* TODO: social media links */}
        </div>
      </div>

      <div className="border-t border-brand-border px-4 py-4 text-center text-xs text-brand-muted">
        &copy; {new Date().getFullYear()} BX Fitness Hub. All rights reserved.
      </div>
    </footer>
  );
}
