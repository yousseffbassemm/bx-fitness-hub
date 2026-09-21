"use client";

import { useState } from "react";

const goals = [
  "Build Muscle",
  "Lose Weight",
  "Improve Fitness",
  "Personal Training",
  "Other",
] as const;

type Errors = Partial<Record<"name" | "phone" | "email" | "goal", string>>;

const field =
  "w-full border border-line bg-ink px-4 py-3.5 text-sm text-white placeholder:text-grey-dim focus:border-lime focus:outline-none";

export default function LeadForm() {
  const [values, setValues] = useState({ name: "", phone: "", email: "", goal: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  function validate() {
    const next: Errors = {};
    if (values.name.trim().length < 2) next.name = "Please enter your name.";
    // Egyptian mobiles are 11 digits; allow +20 and spacing.
    if (!/^[+\d][\d\s-]{8,17}$/.test(values.phone.trim()))
      next.phone = "Please enter a phone number we can reach you on.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim()))
      next.email = "Please enter a valid email address.";
    if (!values.goal) next.goal = "Pick the one closest to your goal.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setState("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Request failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  function set(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  if (state === "done") {
    return (
      <div className="border border-lime/40 bg-lime/5 p-8" role="status">
        <p className="font-display text-2xl text-lime">You&apos;re on the list.</p>
        <p className="mt-3 text-sm leading-relaxed text-grey">
          We&apos;ll be in touch on the number you gave us. If you&apos;d rather
          not wait, message us on WhatsApp and we&apos;ll answer straight away.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="lf-name" className="kicker mb-2 block">
          Name
        </label>
        <input
          id="lf-name"
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "lf-name-err" : undefined}
          className={field}
          placeholder="Your name"
        />
        {errors.name && (
          <p id="lf-name-err" className="mt-2 text-xs text-pink">
            {errors.name}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lf-phone" className="kicker mb-2 block">
            Phone
          </label>
          <input
            id="lf-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "lf-phone-err" : undefined}
            className={field}
            placeholder="010 0000 0000"
          />
          {errors.phone && (
            <p id="lf-phone-err" className="mt-2 text-xs text-pink">
              {errors.phone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lf-email" className="kicker mb-2 block">
            Email
          </label>
          <input
            id="lf-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "lf-email-err" : undefined}
            className={field}
            placeholder="you@email.com"
          />
          {errors.email && (
            <p id="lf-email-err" className="mt-2 text-xs text-pink">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="lf-goal" className="kicker mb-2 block">
          Goal
        </label>
        <select
          id="lf-goal"
          name="goal"
          value={values.goal}
          onChange={(e) => set("goal", e.target.value)}
          aria-invalid={!!errors.goal}
          aria-describedby={errors.goal ? "lf-goal-err" : undefined}
          className={`${field} appearance-none`}
        >
          <option value="">Choose one</option>
          {goals.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {errors.goal && (
          <p id="lf-goal-err" className="mt-2 text-xs text-pink">
            {errors.goal}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={state === "sending"}
        className="font-display w-full bg-lime py-4 text-[0.8rem] tracking-[0.14em] text-ink transition-colors hover:bg-white disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Start My Journey"}
      </button>

      {state === "error" && (
        <p role="alert" className="text-xs text-pink">
          Something went wrong sending that. Please try again, or message us on
          WhatsApp.
        </p>
      )}

      <p className="text-xs leading-relaxed text-grey-dim">
        We use your details to answer this enquiry, nothing else.
      </p>
    </form>
  );
}
