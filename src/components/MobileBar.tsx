import { site } from "@/lib/site";

/**
 * Sticky contact bar for phones. Three taps that matter: call, WhatsApp,
 * join. Hidden from md up, where the header CTA is always in reach.
 */
export default function MobileBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-3 divide-x divide-line">
        <a
          href={site.phone.href}
          className="font-display flex items-center justify-center py-4 text-[0.72rem] tracking-[0.14em] text-white"
        >
          Call
        </a>
        <a
          href={site.whatsapp.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-display flex items-center justify-center py-4 text-[0.72rem] tracking-[0.14em] text-white"
        >
          WhatsApp
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
