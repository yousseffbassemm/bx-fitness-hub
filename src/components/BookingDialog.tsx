"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/booking";
import type { Session } from "@/lib/site";

export type BookingTarget = {
  id: string;
  date: string;
  session: Session;
  spotsLeft: number | null;
  /** Booking a free place, or joining the queue for a full one. */
  mode: "book" | "waitlist";
};

/**
 * text-base, not text-sm. Safari zooms the whole page in when a field under
 * 16px takes focus, and then leaves it zoomed - which is why tapping Book on
 * a phone blew the site up and needed pinching back out. 16px is the
 * threshold; from sm up it can go back to the smaller size.
 */
const field =
  "w-full rounded-sm border border-white/15 bg-ink px-4 py-3.5 text-base text-white placeholder:text-grey-dim focus:border-lime focus:outline-none sm:text-sm";

export default function BookingDialog({
  target,
  onClose,
  onBooked,
}: {
  target: BookingTarget;
  onClose: () => void;
  onBooked: (id: string, date: string, spotsLeft: number) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [manageUrl, setManageUrl] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panel = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    firstField.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;

      // Keep tabbing inside the dialog while it is open.
      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!/^[+\d][\d\s-]{8,17}$/.test(phone.trim()))
      return setError("Please enter a phone number we can reach you on.");

    setState("sending");
    const waiting = target.mode === "waitlist";

    try {
      const res = await fetch(waiting ? "/api/classes/waitlist" : "/api/classes/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: target.id,
          date: target.date,
          name: name.trim(),
          phone: phone.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState("idle");
        return setError(
          data.error ?? (waiting ? "Could not add you to the list." : "Could not take that booking."),
        );
      }

      if (waiting) {
        setPosition(data.position ?? null);
        setState("done");
        return;
      }

      onBooked(target.id, target.date, data.spotsLeft);
      if (data.token) {
        const url = `${window.location.origin}/b/${data.token}`;
        setManageUrl(url);
        /*
          Remembered on this device so the timetable can show "you are
          booked" and offer the cancel link again later. Wrapped because
          private browsing throws on write, and a booking that succeeded
          must not look like a failure over a convenience.
        */
        try {
          const key = "bx:bookings";
          const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
          saved[`${target.id}|${target.date}`] = data.token;
          localStorage.setItem(key, JSON.stringify(saved));
        } catch {
          // No local storage: the link on screen is still the way back.
        }
      }
      setState("done");
    } catch {
      setState("idle");
      setError("Could not reach the gym. Please try again.");
    }
  }

  return (
    <div
      /*
        Centred at every size, and the overlay scrolls rather than the panel
        being pinned to an edge - with a keyboard open on a phone, an
        items-end sheet ends up half off the screen. h-dvh tracks the visible
        viewport as the browser chrome comes and goes.
      */
      className="dialog-backdrop fixed inset-0 z-[70] h-dvh overflow-y-auto overscroll-contain bg-ink/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-title"
          onClick={(e) => e.stopPropagation()}
          className="dialog-panel w-full max-w-md rounded-lg border border-white/12 bg-gradient-to-b from-[#16191c] to-ink p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] sm:rounded-sm sm:p-7"
        >
          {state === "done" ? (
            <div role="status" className="text-center">
              {/* The ring lands, then the tick draws itself into it. */}
              <svg
                viewBox="0 0 52 52"
                className="mx-auto h-16 w-16"
                aria-hidden="true"
              >
                <circle
                  className="tick-ring"
                  cx="26"
                  cy="26"
                  r="24"
                  fill="none"
                  stroke="var(--bx-lime)"
                  strokeWidth="2"
                  style={{ transformOrigin: "center" }}
                />
                <path
                  className="tick-path"
                  d="M15 27l8 8 15-16"
                  fill="none"
                  stroke="var(--bx-lime)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <h2
                id="booking-title"
                className="font-display done-step mt-6 text-3xl text-lime"
                style={{ animationDelay: "0.35s" }}
              >
                {target.mode === "waitlist" ? "You're on the list." : "You're in."}
              </h2>
              <p
                className="done-step mt-4 text-sm leading-relaxed text-grey"
                style={{ animationDelay: "0.45s" }}
              >
                {target.mode === "waitlist" ? (
                  <>
                    {position ? `Number ${position} for ` : "For "}
                    {target.session.discipline}, {formatDate(target.date)} at{" "}
                    {target.session.time}. If a place frees up it is yours, and
                    we will call you on the number you gave us.
                  </>
                ) : (
                  <>
                    {target.session.discipline} with {target.session.coach},{" "}
                    {formatDate(target.date)} at {target.session.time}. Come 10
                    minutes early if it&apos;s your first time.
                  </>
                )}
              </p>
              {manageUrl && (
                <div
                  className="done-step mt-6 rounded-sm border border-white/10 bg-ink/60 p-4 text-left"
                  style={{ animationDelay: "0.5s" }}
                >
                  <p className="kicker mb-2">If you cannot make it</p>
                  <p className="text-xs leading-relaxed text-grey">
                    Use this link to give your place up, so somebody else can
                    take it.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-sm bg-charcoal px-3 py-2 text-[0.7rem] text-grey-dim">
                      {manageUrl}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(manageUrl);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        } catch {
                          // Clipboard refused; the link is on screen to copy.
                        }
                      }}
                      className="font-display shrink-0 rounded-sm border border-white/15 px-3 py-2 text-[0.68rem] tracking-[0.1em] text-grey hover:border-lime hover:text-lime"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="font-display done-step mt-6 w-full rounded-sm bg-lime py-3.5 text-[0.8rem] tracking-[0.14em] text-ink transition-colors hover:bg-white"
                style={{ animationDelay: "0.6s" }}
              >
                Done
              </button>
            </div>
          ) : (
          <form onSubmit={submit} noValidate>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-lime" />
                <span className="kicker">
                  {target.mode === "waitlist" ? "Join the waitlist" : "Book a place"}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-xs text-grey hover:text-white"
              >
                Close
              </button>
            </div>

            <h2 id="booking-title" className="font-display mt-5 text-3xl text-white">
              {target.session.discipline}
            </h2>
            <p className="mt-2 text-sm text-grey">
              {target.session.coach} &middot; {formatDate(target.date)} &middot;{" "}
              {target.session.time}
            </p>

            {target.session.ladiesOnly && (
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-pink">
                <span className="h-1.5 w-1.5 rounded-full bg-pink" />
                Ladies only
              </p>
            )}

            {target.mode === "waitlist" ? (
              <p className="mt-3 text-xs text-amber">
                This class is full. We will call you if a place frees up.
              </p>
            ) : (
              target.spotsLeft !== null && (
                <p className="mt-3 text-xs text-grey-dim">
                  {target.spotsLeft} {target.spotsLeft === 1 ? "place" : "places"} left
                </p>
              )
            )}

            <div className="mt-7 space-y-4">
              <div>
                <label htmlFor="bk-name" className="kicker mb-2 block">
                  Name
                </label>
                <input
                  id="bk-name"
                  ref={firstField}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={field}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="bk-phone" className="kicker mb-2 block">
                  Phone
                </label>
                <input
                  id="bk-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={field}
                  placeholder="010 0000 0000"
                />
                <p className="mt-2 text-xs text-grey-dim">
                  We use this to confirm and to find your booking on the door.
                </p>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-xs text-pink">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={state === "sending"}
              className="font-display mt-6 w-full rounded-sm bg-lime py-4 text-[0.8rem] tracking-[0.14em] text-ink transition-colors hover:bg-white disabled:opacity-60"
            >
              {state === "sending"
                ? target.mode === "waitlist"
                  ? "Adding…"
                  : "Booking…"
                : target.mode === "waitlist"
                  ? "Join the waitlist"
                  : "Confirm Place"}
            </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
