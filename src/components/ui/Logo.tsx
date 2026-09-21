/**
 * The BX monogram, redrawn from the sign on the gym wall: a raised circle,
 * a hooked arc, and a bar cutting across them.
 */
export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="currentColor">
      <circle cx="37.5" cy="15.5" r="8" />
      <path d="M31 39.5a11.5 11.5 0 1 1 11.5-11.5h-8A3.5 3.5 0 1 0 31 31.5z" />
      <path d="M19.5 44.5 48 16l6.5 6.5L26 51z" />
      <path d="M40.5 45.5 48 38l6.5 6.5L47 52z" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-white">
      <Mark className="h-8 w-8 shrink-0" />
      {!compact && (
        <span className="leading-none">
          <span className="font-display block text-[0.9rem] tracking-tight">BX</span>
          <span className="font-display block text-[0.9rem] tracking-tight">Fitness Hub</span>
        </span>
      )}
    </span>
  );
}
