"use client";

import { useState } from "react";
import { disciplines, schedule, site } from "@/lib/site";
import Reveal from "../ui/Reveal";
import SectionHead from "../ui/SectionHead";

const intensityBar: Record<string, number> = { High: 3, Moderate: 2, Low: 1 };

export default function Classes() {
  const [day, setDay] = useState(0);
  const active = schedule[day];

  return (
    <section id="classes" className="relative py-24 lg:py-32">
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
              <br className="hidden sm:block" /> Book a place on WhatsApp.
            </p>
          </Reveal>
        </div>

        {/* Discipline cards */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {disciplines.map((d, i) => (
            <Reveal key={d.name} delay={(i % 4) * 70}>
              <article className="group h-full rounded-sm border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 transition-all duration-500 hover:-translate-y-1 hover:border-lime/40">
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
          <div className="rounded-sm border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
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
              {active.sessions.length === 0 ? (
                <p className="font-display py-8 text-center text-3xl text-grey-dim">
                  Friday off
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {active.sessions.map((s) => (
                    <li
                      key={`${s.time}-${s.discipline}`}
                      className="grid grid-cols-[5.5rem_1fr] items-baseline gap-4 py-5 sm:grid-cols-[7rem_1fr_auto]"
                    >
                      <span className="font-display text-sm text-lime">{s.time}</span>
                      <span>
                        <span className="font-display block text-lg text-white">
                          {s.discipline}
                        </span>
                        <span className="mt-1 block text-sm text-grey">{s.coach}</span>
                      </span>
                      <span className="col-span-2 sm:col-span-1 sm:justify-self-end">
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
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
            <a
              href={site.whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display bg-lime px-6 py-3.5 text-[0.8rem] tracking-[0.12em] text-ink transition-colors hover:bg-white"
            >
              Book a class
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
    </section>
  );
}
