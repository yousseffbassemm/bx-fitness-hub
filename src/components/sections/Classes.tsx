"use client";

import { useEffect, useState } from "react";
import {
  formatDate,
  nextDateForRow,
  sessionId,
  slotKey,
  toISODate,
  type Availability,
} from "@/lib/booking";
import { disciplines, schedule, site } from "@/lib/site";
import BookingDialog, { type BookingTarget } from "../BookingDialog";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

const intensityBar: Record<string, number> = { High: 3, Moderate: 2, Low: 1 };

export default function Classes() {
  const [day, setDay] = useState(0);
  const active = schedule[day];

  // Dates and availability arrive together, once, after the fetch settles.
  // The dates are resolved in the visitor's own timezone so nobody is booked
  // onto the wrong day from another country.
  const [data, setData] = useState<{ dates: string[]; spots: Availability } | null>(
    null,
  );
  const [target, setTarget] = useState<BookingTarget | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const dates = schedule.map((_, i) => toISODate(nextDateForRow(i)));
      const sorted = [...dates].sort();
      const spots: Availability = {};

      try {
        const res = await fetch(
          `/api/classes/availability?from=${sorted[0]}&to=${sorted[sorted.length - 1]}`,
          { cache: "no-store" },
        );

        if (res.ok) {
          const { capacity, taken } = (await res.json()) as {
            capacity: Record<string, number>;
            taken: Record<string, number>;
          };

          schedule.forEach((d, i) => {
            d.sessions.forEach((sess) => {
              const id = sessionId(i, sess);
              const key = slotKey(id, dates[i]);
              spots[key] = Math.max(0, (capacity[id] ?? 0) - (taken[key] ?? 0));
            });
          });
        }
      } catch {
        // Availability is a nicety - the timetable still reads without it,
        // and booking will re-check capacity server-side anyway.
      }

      if (!cancelled) setData({ dates, spots });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dates = data?.dates ?? [];
  const spots = data?.spots ?? null;

  function onBooked(id: string, date: string, spotsLeft: number) {
    setData((prev) =>
      prev ? { ...prev, spots: { ...prev.spots, [slotKey(id, date)]: spotsLeft } } : prev,
    );
  }

  return (
    <section id="classes" className="relative py-16 lg:py-24">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHead
            kicker="Classes"
            title="Open for members"
            accent="& non-members."
          />
          <Reveal>
            <p className="text-sm text-grey sm:text-right">
              Timetable current for September 2026.
              <br className="hidden sm:block" /> Book a place below.
            </p>
          </Reveal>
        </div>

        {/* Discipline cards */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {disciplines.map((d, i) => (
            <Reveal key={d.name} variant="scale" delay={(i % 4) * 80}>
              <article className="surface group h-full rounded-md p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg leading-tight text-white">{d.name}</h3>
                  <span
                    className="flex shrink-0 items-end gap-[3px] pt-1"
                    aria-label={`${d.intensity} intensity`}
                  >
                    {[1, 2, 3].map((n) => (
                      <span
                        key={n}
                        className={`w-[3px] ${
                          n <= intensityBar[d.intensity] ? "bg-lime" : "bg-line"
                        }`}
                        style={{ height: `${n * 4 + 3}px` }}
                      />
                    ))}
                  </span>
                </div>
                <p className="mt-2 text-sm text-grey">{d.note}</p>
                <p className="kicker mt-4 text-grey-dim">{d.intensity} intensity</p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Timetable */}
        <Reveal className="mt-16">
          <div className="surface rounded-md">
            <div
              role="tablist"
              aria-label="Class timetable by day"
              className="flex overflow-x-auto border-b border-line"
            >
              {schedule.map((d, i) => (
                <button
                  key={d.day}
                  role="tab"
                  id={`day-tab-${i}`}
                  aria-selected={day === i}
                  aria-controls={`day-panel-${i}`}
                  tabIndex={day === i ? 0 : -1}
                  onClick={() => setDay(i)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") setDay((day + 1) % schedule.length);
                    if (e.key === "ArrowLeft")
                      setDay((day - 1 + schedule.length) % schedule.length);
                  }}
                  className={`font-display shrink-0 px-6 py-4 text-[0.8rem] tracking-[0.12em] transition-colors ${
                    day === i
                      ? "bg-lime text-ink"
                      : "text-grey hover:bg-raised hover:text-white"
                  }`}
                >
                  <span className="sm:hidden">{d.short}</span>
                  <span className="hidden sm:inline">{d.day}</span>
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id={`day-panel-${day}`}
              aria-labelledby={`day-tab-${day}`}
              className="p-6 sm:p-8"
            >
              {dates[day] && active.sessions.length > 0 && (
                <p className="kicker mb-5 text-grey-dim">
                  Next up &middot; {formatDate(dates[day])}
                </p>
              )}

              {active.sessions.length === 0 ? (
                <p className="font-display py-8 text-center text-3xl text-grey-dim">
                  Friday off
                </p>
              ) : (
                <ul className="divide-y divide-white/8">
                  {active.sessions.map((s) => {
                    const id = sessionId(day, s);
                    const date = dates[day];
                    const left = date ? (spots?.[slotKey(id, date)] ?? null) : null;
                    const full = left === 0;

                    return (
                      <li
                        key={`${s.time}-${s.discipline}`}
                        className="grid grid-cols-[5.5rem_1fr] items-center gap-4 py-5 sm:grid-cols-[7rem_1fr_auto_auto]"
                      >
                        <span className="font-display self-start text-sm text-lime sm:self-center">
                          {s.time}
                        </span>

                        <span>
                          <span className="font-display block text-lg text-white">
                            {s.discipline}
                          </span>
                          <span className="mt-1 block text-sm text-grey">{s.coach}</span>
                        </span>

                        <span className="col-span-2 flex items-center gap-4 sm:col-span-1 sm:justify-self-end">
                          {s.ladiesOnly ? (
                            <span className="inline-flex items-center gap-2 text-xs text-pink">
                              <span className="h-1.5 w-1.5 rounded-full bg-pink" />
                              Ladies only
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-xs text-grey-dim">
                              <span className="h-1.5 w-1.5 rounded-full bg-lime" />
                              Mixed
                            </span>
                          )}

                          {left !== null && (
                            <span
                              className={`text-xs tabular-nums ${
                                full
                                  ? "text-grey-dim"
                                  : left <= 3
                                    ? "text-amber"
                                    : "text-grey-dim"
                              }`}
                            >
                              {full ? "Full" : `${left} left`}
                            </span>
                          )}
                        </span>

                        <span className="col-span-2 sm:col-span-1 sm:justify-self-end">
                          <button
                            type="button"
                            disabled={full || !date}
                            onClick={() =>
                              setTarget({ id, date, session: s, spotsLeft: left })
                            }
                            className="font-display w-full rounded-sm border border-lime/50 px-5 py-2.5 text-[0.74rem] tracking-[0.12em] text-lime transition-all duration-300 hover:bg-lime hover:text-ink disabled:cursor-not-allowed disabled:border-white/10 disabled:text-grey-dim disabled:hover:bg-transparent sm:w-auto"
                          >
                            {full ? "Full" : "Book"}
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
            <a
              href={site.phone.href}
              className="font-display rounded-sm border border-white/15 px-6 py-3.5 text-[0.8rem] tracking-[0.12em] text-white transition-colors hover:border-lime hover:text-lime"
            >
              Call about a class
            </a>
            <p className="text-xs text-grey-dim">
              Schedules change monthly &mdash; the live version is always on{" "}
              <a
                href={site.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-grey underline underline-offset-4 hover:text-lime"
              >
                @bx_fitnesshub
              </a>
              .
            </p>
          </div>
        </Reveal>
      </div>

      {target && (
        <BookingDialog
          target={target}
          onClose={() => setTarget(null)}
          onBooked={onBooked}
        />
      )}
    </section>
  );
}
