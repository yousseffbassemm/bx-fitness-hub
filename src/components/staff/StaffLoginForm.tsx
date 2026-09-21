"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function StaffLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const res = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setBusy(false);
        setPassword("");
        return setError(data.error ?? "Could not sign you in.");
      }

      // Only follow an in-app path, so ?next= cannot bounce anyone off-site.
      const next = params.get("next");
      const destination = next?.startsWith("/staff") ? next : "/staff";
      router.replace(destination);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Could not reach the server.");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor="staff-password" className="kicker mb-2 block">
        Password
      </label>
      <input
        id="staff-password"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-sm border border-white/15 bg-charcoal px-4 py-3.5 text-sm text-white focus:border-lime focus:outline-none"
      />

      {error && (
        <p role="alert" className="mt-3 text-xs text-pink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="font-display mt-5 w-full rounded-sm bg-lime py-3.5 text-[0.8rem] tracking-[0.14em] text-ink transition-colors hover:bg-white disabled:opacity-60"
      >
        {busy ? "Checking…" : "Sign In"}
      </button>
    </form>
  );
}
