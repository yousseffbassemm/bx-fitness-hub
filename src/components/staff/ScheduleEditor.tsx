"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ScheduleDay, EditableSession } from "@/lib/content";

const field =
  "w-full rounded-sm border border-white/15 bg-ink px-2.5 py-2 text-base text-white placeholder:text-grey-dim focus:border-lime focus:outline-none sm:text-sm";

/** Matches lib/content.ts. Generated here so a new row has an id immediately. */
function newId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `s-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The weekly timetable.
 *
 * Each class keeps its id through every edit, which is what keeps a booking
 * attached to it. Moving the 7pm Boxing to 8pm therefore moves the people who
 * booked it; removing the class orphans them, which the bookings page now
 * says out loud rather than quietly dropping them.
 */
export default function ScheduleEditor({
  schedule,
  bookedIds,
}: {
  schedule: ScheduleDay[];
  /** Session ids that have at least one live booking in the next two weeks. */
  bookedIds: Record<string, number>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(schedule);
  const [open, setOpen] = useState(0);
  const [busy, setBusy] = useState(false);
  /** The class whose removal is waiting on a second press. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(schedule);

  function editSession(d: number, i: number, patch: Partial<EditableSession>) {
    setSaved(false);
    setDraft((s) =>
      s.map((day, dn) =>
        dn !== d
          ? day
          : {
              ...day,
              sessions: day.sessions.map((sess, sn) =>
                sn === i ? { ...sess, ...patch } : sess,
              ),
            },
      ),
    );
  }

  function addSession(d: number) {
    setSaved(false);
    setDraft((s) =>
      s.map((day, dn) =>
        dn !== d
          ? day
          : {
              ...day,
              sessions: [
                ...day.sessions,
                { id: newId(), time: "", coach: "", discipline: "" },
              ],
            },
      ),
    );
  }

  function removeSession(d: number, i: number) {
    setSaved(false);
    setDraft((s) =>
      s.map((day, dn) =>
        dn !== d ? day : { ...day, sessions: day.sessions.filter((_, sn) => sn !== i) },
      ),
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "schedule", value: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(false);
        return setError(data.error ?? "That did not save.");
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setBusy(false), 400);
    } catch {
      setBusy(false);
      setError("Could not reach the server.");
    }
  }

  return (
    <div>
      {/* Day tabs */}
      <div className="flex flex-wrap gap-1.5">
        {draft.map((day, i) => (
          <button
            key={day.day}
            type="button"
            onClick={() => setOpen(i)}
            className={`font-display rounded-sm border px-3 py-2 text-[0.7rem] tracking-[0.1em] ${
              open === i
                ? "border-lime bg-lime text-ink"
                : "border-white/15 text-grey hover:text-white"
            }`}
          >
            {day.short}
            <span className="ml-1.5 opacity-60">{day.sessions.length}</span>
          </button>
        ))}
      </div>

      {/* The open day */}
      <div className="mt-5 rounded-sm border border-white/10 bg-charcoal p-5">
        <h3 className="font-display text-base text-white">{draft[open].day}</h3>

        {draft[open].sessions.length === 0 ? (
          <p className="mt-4 text-sm text-grey-dim">No classes on this day.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {draft[open].sessions.map((sess, i) => {
              const booked = bookedIds[sess.id] ?? 0;
              return (
                <div
                  key={sess.id}
                  className="grid gap-2 border-b border-white/8 pb-3 sm:grid-cols-[6.5rem_1fr_1fr_auto] sm:items-start"
                >
                  <input
                    aria-label="Time"
                    className={field}
                    placeholder="7:00 PM"
                    value={sess.time}
                    onChange={(e) => editSession(open, i, { time: e.target.value })}
                  />
                  <input
                    aria-label="Class"
                    className={field}
                    placeholder="Boxing"
                    value={sess.discipline}
                    onChange={(e) =>
                      editSession(open, i, { discipline: e.target.value })
                    }
                  />
                  <input
                    aria-label="Coach"
                    className={field}
                    placeholder="Coach"
                    value={sess.coach}
                    onChange={(e) => editSession(open, i, { coach: e.target.value })}
                  />

                  <div className="flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[0.68rem] text-grey">
                      <input
                        type="checkbox"
                        className="accent-pink"
                        checked={Boolean(sess.ladiesOnly)}
                        onChange={(e) =>
                          editSession(open, i, {
                            ladiesOnly: e.target.checked ? true : undefined,
                          })
                        }
                      />
                      Ladies
                    </label>
                    {/*
                      A class nobody has booked goes on one click - it is
                      just a row. One with people on it asks first, because
                      removing it strands them: their bookings keep an id
                      the timetable no longer has, and putting the class
                      back does not undo it. A new row is a new class, so it
                      gets a new id, and the old bookings stay orphaned.
                      Every other Remove in here asks; this was the one that
                      did not, and it had the most to lose.
                    */}
                    {booked > 0 && confirming === sess.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            removeSession(open, i);
                            setConfirming(null);
                          }}
                          className="rounded-sm bg-pink px-2 py-1.5 text-xs text-white"
                        >
                          Remove anyway
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="px-1 text-xs text-grey hover:text-white"
                        >
                          Keep
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          booked > 0 ? setConfirming(sess.id) : removeSession(open, i)
                        }
                        className="rounded-sm border border-white/15 px-2 py-1.5 text-xs text-grey hover:border-pink hover:text-pink"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* One line, not a paragraph: on a busy day this repeats
                      under every row, and the same warning said three times
                      stops being read. The detail lives under the form. */}
                  {booked > 0 && (
                    <p className="flex items-center gap-1.5 text-[0.68rem] text-amber sm:col-span-4">
                      <span aria-hidden="true">&#9679;</span>
                      {confirming === sess.id
                        ? `${booked} booked - they would be left on a class that is not there, and putting it back will not undo it.`
                        : `${booked} booked`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => addSession(open)}
          className="font-display mt-4 w-full rounded-sm border border-dashed border-white/20 py-2.5 text-[0.7rem] tracking-[0.12em] text-grey hover:border-lime hover:text-lime"
        >
          + Add a class to {draft[open].day}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-pink">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={save}
          className="font-display rounded-sm bg-lime px-6 py-3 text-[0.75rem] tracking-[0.12em] text-ink transition-colors hover:bg-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save timetable"}
        </button>

        {dirty && !busy && (
          <button
            type="button"
            onClick={() => {
              setDraft(schedule);
              setError(null);
            }}
            className="text-sm text-grey-dim hover:text-white"
          >
            Undo changes
          </button>
        )}

        {saved && !dirty && (
          <span role="status" className="text-sm text-lime">
            Saved. The site is updated.
          </span>
        )}
      </div>

      <div className="mt-5 space-y-2 text-xs leading-relaxed text-grey-dim">
        <p>
          <span className="text-amber">&#9679;</span> marks a class people have
          already booked. Changing its time or name moves those bookings with
          it. Removing it leaves them booked on nothing, and they appear at the
          top of Bookings so you can call them.
        </p>
        <p>
          Times show exactly as typed &mdash; keep the format consistent, like
          &ldquo;7:00 PM&rdquo;. The seven days are fixed; what is in them is not.
        </p>
      </div>
    </div>
  );
}
