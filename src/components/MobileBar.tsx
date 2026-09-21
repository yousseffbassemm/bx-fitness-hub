import { site } from "@/lib/site";

/**
 * Sticky contact bar for phones. Three taps that matter: call, book a class,
 * join. Hidden from md up, where the header CTA is always in reach.
 */
export default function MobileBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/90 backdrop-blur-2xl backdrop-saturate-150 md:hidden">
      <div className="grid grid-cols-3 divide-x divide-white/10">
        <a
          href={site.phone.href}
          className="font-display flex items-center justify-center py-4 text-[0.72rem] tracking-[0.14em] text-white"
        >
          Call
        </a>
        <a
          href="#classes"
          className="font-display flex items-center justify-center py-4 text-[0.72rem] tracking-[0.14em] text-white"
        >
          Book
        </a>
        <a
          href="#membership"
          className="font-display flex items-center justify-center bg-lime py-4 text-[0.72rem] tracking-[0.14em] text-ink"
        >
          Join
        </a>
      </div>
    </div>
  );
}
