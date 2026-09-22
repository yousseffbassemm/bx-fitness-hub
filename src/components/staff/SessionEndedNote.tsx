"use client";

import { useSearchParams } from "next/navigation";

/**
 * Says why somebody was signed out, when they did not do it themselves.
 *
 * Landing on a login screen you did not ask for is disorienting, and the
 * honest explanation is short: the account is gone. Without this it reads as
 * the site having lost your session.
 */
export default function SessionEndedNote() {
  const ended = useSearchParams().get("ended");
  if (!ended) return null;

  return (
    <p
      role="status"
      className="mt-6 rounded-sm border border-amber/40 bg-amber/[0.06] px-4 py-3 text-sm leading-relaxed text-grey"
    >
      You have been signed out because that account no longer exists. If that
      is a surprise, speak to whoever manages the team.
    </p>
  );
}
