import { disciplines } from "@/lib/site";

/**
 * A thin band of everything on the timetable, running edge to edge between
 * the hero and the introduction. Paused for anyone who asked for less motion
 * (handled globally in globals.css).
 */
export default function Marquee() {
  const items = disciplines.map((d) => d.name);

  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden border-y border-line bg-charcoal py-4"
    >
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 items-center">
            {items.map((name) => (
              <li key={name} className="flex items-center">
                <span className="font-display px-6 text-sm tracking-[0.14em] text-grey-dim">
                  {name}
                </span>
                <span className="h-1 w-1 rounded-full bg-lime" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
