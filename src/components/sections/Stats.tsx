"use client";

import { useEffect, useRef, useState } from "react";
import { stats } from "@/lib/site";
import Reveal from "../ui/Reveal";

function useCountUp(target: number, decimals: number, run: boolean) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run) return;

    // Anyone who asked for less motion lands on the final figure on the first
    // frame rather than watching it climb.
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 1200;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const p = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      // ease-out cubic
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, run]);

  return value.toFixed(decimals);
}

function Stat({
  value,
  suffix,
  label,
  note,
  decimals = 0,
  run,
  index,
}: {
  value: number;
  suffix: string;
  label: string;
  note: string;
  decimals?: number;
  run: boolean;
  index: number;
}) {
  const shown = useCountUp(value, decimals, run);

  return (
    <Reveal
      variant="scale"
      delay={index * 90}
      className="surface rounded-md p-7 lg:p-9"
    >
      <p className="font-display text-5xl text-white lg:text-6xl">
        {shown}
        <span className="text-lime">{suffix}</span>
      </p>
      <p className="font-display mt-4 text-[0.82rem] tracking-[0.1em] text-white">{label}</p>
      <p className="mt-1.5 text-xs text-grey-dim">{note}</p>
    </Reveal>
  );
}

export default function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRun(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative">
      <div ref={ref} className="mx-auto grid max-w-[1600px] grid-cols-2 gap-4 px-6 lg:grid-cols-4 lg:px-12">
        {stats.map((s, i) => (
          <Stat key={s.label} {...s} run={run} index={i} />
        ))}
      </div>
    </section>
  );
}
