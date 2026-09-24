"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate, slotKey } from "@/lib/booking";
import { remember } from "@/lib/my-bookings";
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
  onBooked: (id: string, date: string, spotsLeft: number, token?: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  /*
    Member or guest, asked before anything else.

    A member's place is part of what they already pay for; a guest pays for
    the class. The desk needs to know which, and asking here is the only
    moment either of them is in front of a form.
  */
  const [who, setWho] = useState<"asking" | "member" | "guest">("asking");
  const [memberRef, setMemberRef] = useState("");
  const [memberName, setMemberName] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [payment, setPayment] = useState<"cash">("cash");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [manageUrl, setManageUrl] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
    Already having a place is not a failure, and it was being shown in the
    same red as one. It reaches this dialog at all only when the device that
    booked is not this one - otherwise the row says "You're in" and never
    opens it.
  */
  const [already, setAlready] = useState(false);

  const panel = useRef<HTMLDivElement>(null);
  /**
   * Whatever the first thing to answer is on this step.
   *
   * It used to always be the name field. Now the dialog opens on a question
   * with two buttons, so this takes either - the point is that a keyboard
   * lands on the first thing there is to do, whatever that is today.
   */
  const firstField = useRef<HTMLElement | null>(null);
  /** Assigned to whichever element is first on the current step. */
  const takeFocus = (el: HTMLElement | null) => {
    firstField.current = el;
  };

  /*
    onClose is an inline arrow in the parent, so a fresh identity arrives on
    every parent render. As an effect dependency it tore the listeners down
    and rebuilt them each time, moving focus back to the first field along
    the way. Held in a ref instead, so the effects below run once for the
    life of the dialog and still call the current one.
  */
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const dismissRef = useRef<() => void>(() => {});

  /*
    Answer the back gesture.

    On a phone, back is how people dismiss a sheet. This one had no history
    entry of its own, so Back left the site entirely - losing their place on
    a long page - instead of closing the dialog.

    The entry is pushed once and popped only by a deliberate close, never by
    the effect's cleanup. Cleanup looked like the obvious place and was
    wrong: Strict Mode runs setup, cleanup, setup on mount, so the cleanup
    popped the entry it had just pushed, and the popstate that followed
    closed the dialog the instant it opened. The ref survives that remount,
    so only one entry is ever added.
  */
  const pushed = useRef(false);
  useEffect(() => {
    if (!pushed.current) {
      window.history.pushState({ bxDialog: true }, "");
      pushed.current = true;
    }
    const onPop = () => {
      // The entry is gone already; nothing left to pop.
      pushed.current = false;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /*
    Every way out of the dialog goes through here. Going back pops our own
    entry, which fires popstate, which closes it - so Back and the Close
    button leave the history in the same state and neither needs pressing
    twice. If the entry is no longer ours, the visitor has navigated on and
    unwinding that would drag them back from wherever they went.
  */
  const dismiss = useCallback((): void => {
    const state = window.history.state as { bxDialog?: boolean } | null;
    if (pushed.current && state?.bxDialog) {
      window.history.back();
      return;
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    firstField.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissRef.current();
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
  }, []);

  /** Ask the gym whether this is a membership, before taking the place. */
  async function findMembership() {
    const reference = memberRef.trim();
    if (!reference) {
      return setError("Enter your membership number, or the phone number we have for you.");
    }

    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/members/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.found) {
        setMemberName(data.firstName ?? "");
        setError(null);
      } else {
        setMemberName(null);
        setError(data.error ?? "We cannot find that membership.");
      }
    } catch {
      setMemberName(null);
      setError("Could not check that just now. You can still book as a guest.");
    } finally {
      setChecking(false);
    }
  }

  /*
    Each step focuses its own first thing.

    Answering "member or guest" removes the button that was just clicked, and
    focus went with it - a keyboard user was dropped at the top of the
    document and had to tab all the way back in. The dialog's own setup
    focuses the first step; this carries that through every step after it.
  */
  useEffect(() => {
    firstField.current?.focus();
  }, [who]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (who === "member") {
      /*
        Find is reassurance, not a gate. Requiring it meant a member could
        type their number, press the one green button on the screen, and
        have nothing happen at all - the button was disabled, so the message
        telling them to press Find never got a chance to show. Correcting a
        typo after a successful Find put them back in the same dead end.
        The membership is checked on the server either way.
      */
      if (!memberRef.trim()) {
        return setError("Enter your membership number, or the phone number we have for you.");
      }
    } else {
      if (name.trim().length < 2) return setError("Please enter your name.");
      if (!/^[+\d][\d\s-]{8,17}$/.test(phone.trim()))
        return setError("Please enter a phone number we can reach you on.");
    }

    setState("sending");
    const waiting = target.mode === "waitlist";

    setAlready(false);
    try {
      const res = await fetch(waiting ? "/api/classes/waitlist" : "/api/classes/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          who === "member"
            ? { sessionId: target.id, date: target.date, member: true, memberRef: memberRef.trim() }
            : {
                sessionId: target.id,
                date: target.date,
                name: name.trim(),
                phone: phone.trim(),
                payment,
              },
        ),
      });
      const data = await res.json();

      if (!res.ok) {
        setState("idle");
        setAlready(data.reason === "duplicate");
        return setError(
          data.reason === "duplicate"
            ? "You already have a place in this class - there is nothing else to do."
            : (data.error ??
              (waiting ? "Could not add you to the list." : "Could not take that booking.")),
        );
      }

      if (waiting) {
        setPosition(data.position ?? null);
        setState("done");
        return;
      }

      onBooked(target.id, target.date, data.spotsLeft, data.token);
      if (data.token) {
        setManageUrl(`${window.location.origin}/b/${data.token}`);
        // Kept against this slot so the timetable can offer the way back.
        remember(slotKey(target.id, target.date), data.token);
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
      onClick={dismiss}
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
                onClick={dismiss}
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
                onClick={dismiss}
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

            {/*
              One question first, because the answer changes what is asked
              next and what happens at the desk.
            */}
            {who === "asking" ? (
              <div className="mt-7 space-y-3">
                <p className="text-sm text-grey">Are you a BX member?</p>
                <button
                  type="button"
                  ref={takeFocus}
                  onClick={() => {
                    setWho("member");
                    setError(null);
                  }}
                  className="font-display w-full rounded-sm border border-lime/50 py-3.5 text-[0.78rem] tracking-[0.12em] text-lime transition-colors hover:bg-lime hover:text-ink"
                >
                  Yes, I&rsquo;m a member
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWho("guest");
                    setError(null);
                  }}
                  className="font-display w-full rounded-sm border border-white/15 py-3.5 text-[0.78rem] tracking-[0.12em] text-grey transition-colors hover:border-white hover:text-white"
                >
                  No, I&rsquo;m a guest
                </button>
                <p className="pt-1 text-xs leading-relaxed text-grey-dim">
                  Classes are open to both. A member&rsquo;s place is part of
                  their membership; a guest pays for the class at the desk.
                </p>
              </div>
            ) : who === "member" ? (
              <div className="mt-7 space-y-4">
                <div>
                  <label htmlFor="bk-member" className="kicker mb-2 block">
                    Membership number or phone
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="bk-member"
                      ref={takeFocus}
                      value={memberRef}
                      onChange={(e) => {
                        setMemberRef(e.target.value);
                        setMemberName(null);
                      }}
                      className={field}
                      placeholder="BX-0142"
                    />
                    <button
                      type="button"
                      onClick={findMembership}
                      disabled={checking}
                      className="font-display shrink-0 rounded-sm border border-white/15 px-4 text-[0.72rem] tracking-[0.1em] text-grey transition-colors hover:border-lime hover:text-lime disabled:opacity-60"
                    >
                      {checking ? "Checking…" : "Find"}
                    </button>
                  </div>
                  {memberName !== null && (
                    <p className="mt-2 text-xs text-lime">
                      Welcome back{memberName ? `, ${memberName}` : ""}. Nothing
                      to pay for this one.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWho("guest");
                    setMemberName(null);
                    setError(null);
                  }}
                  className="text-xs text-grey-dim underline-offset-4 hover:text-white hover:underline"
                >
                  Not a member after all? Book as a guest
                </button>
              </div>
            ) : (
              <div className="mt-7 space-y-4">
                <div>
                  <label htmlFor="bk-name" className="kicker mb-2 block">
                    Name
                  </label>
                  <input
                    id="bk-name"
                    ref={takeFocus}
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
                <div>
                  <label htmlFor="bk-payment" className="kicker mb-2 block">
                    Paying by
                  </label>
                  <select
                    id="bk-payment"
                    value={payment}
                    onChange={(e) => setPayment(e.target.value as "cash")}
                    className={field}
                  >
                    <option value="cash">Cash at the desk</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setWho("member");
                    setError(null);
                  }}
                  className="text-xs text-grey-dim underline-offset-4 hover:text-white hover:underline"
                >
                  Actually, I&rsquo;m a member
                </button>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className={`mt-4 text-xs ${already ? "text-lime" : "text-pink"}`}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              hidden={who === "asking"}
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
