import type { ReactNode } from "react";

/**
 * One header shape for every staff screen, so moving between them does not
 * feel like moving between three different products.
 *
 * The count belongs in the heading rather than in a stat card above it: on
 * these pages the number *is* the heading - "12 bookings" is the whole answer
 * to why someone opened the page.
 */
export default function PageHeader({
  kicker,
  title,
  copy,
  actions,
}: {
  kicker?: string;
  title: ReactNode;
  copy?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <div className="min-w-0">
        {kicker && (
          <div className="flex items-center gap-3">
            <span className="h-px w-6 bg-lime" />
            <span className="kicker">{kicker}</span>
          </div>
        )}
        <h1 className="font-display mt-4 text-3xl leading-tight text-white sm:text-4xl">
          {title}
        </h1>
        {copy && <p className="mt-2 max-w-xl text-sm leading-relaxed text-grey">{copy}</p>}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
