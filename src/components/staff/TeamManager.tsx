"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StaffRole } from "@/lib/store/types";

export type TeamMember = {
  username: string;
  role: StaffRole;
  createdAt: string;
  lastLoginAt: string | null;
};

const field =
  "w-full rounded-sm border border-white/15 bg-ink px-3 py-2.5 text-base text-white placeholder:text-grey-dim focus:border-lime focus:outline-none sm:text-sm";

/** Readable, and long enough that it is not worth guessing. */
function suggestPassword() {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const picks = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(picks, (n) => alphabet[n % alphabet.length]).join("");
}

function when(value: string | null) {
  if (!value) return "never";
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

/**
 * Account management, for admins.
 *
 * Everything here is reversible except removing someone, which takes two
 * clicks. The server refuses to let the last admin be demoted or removed,
 * and refuses to let anyone do either to themselves - an account screen
 * nobody can open is only fixable by someone with a terminal.
 */
export default function TeamManager({
  members,
  me,
}: {
  members: TeamMember[];
  me: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  // New account
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");

  // Password reset
  const [resetting, setResetting] = useState<string | null>(null);
  const [resetTo, setResetTo] = useState("");

  async function call(
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
    label: string,
    done?: () => void,
  ) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/staff/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBusy(null);
        return setError(data.error ?? "That did not work.");
      }
      done?.();
      router.refresh();
      setTimeout(() => setBusy(null), 400);
    } catch {
      setBusy(null);
      setError("Could not reach the server.");
    }
  }

  return (
    <div>
      {/* Add someone */}
      <form
        className="rounded-sm border border-white/10 bg-charcoal p-5"
        onSubmit={(e) => {
          e.preventDefault();
          call("POST", { username: name, password, role }, "new", () => {
            setNotice(
              `Created "${name.trim().toLowerCase()}". Give them the password now - it cannot be read back later.`,
            );
            setName("");
            setPassword("");
            setRole("staff");
          });
        }}
      >
        <h3 className="kicker mb-4">Add someone</h3>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input
            aria-label="Username"
            className={field}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex gap-2">
            <input
              aria-label="Password"
              className={field}
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setPassword(suggestPassword())}
              className="font-display shrink-0 rounded-sm border border-white/15 px-3 text-[0.68rem] tracking-[0.1em] text-grey hover:border-lime hover:text-lime"
            >
              Suggest
            </button>
          </div>

          <select
            aria-label="Role"
            className={`${field} [color-scheme:dark]`}
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>

          <button
            type="submit"
            disabled={busy === "new"}
            className="font-display rounded-sm bg-lime px-5 py-2.5 text-[0.72rem] tracking-[0.12em] text-ink transition-colors hover:bg-white disabled:opacity-60"
          >
            {busy === "new" ? "Adding…" : "Add"}
          </button>
        </div>

        <p className="mt-3 text-xs text-grey-dim">
          Staff see the bookings and the enquiries. Admin can also manage this
          list. The password is shown to you once and stored only as a hash.
        </p>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-sm text-pink">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm text-lime">
          {notice}
        </p>
      )}

      {/* The team */}
      <ul className="mt-6 divide-y divide-white/8 rounded-sm border border-white/10 bg-charcoal">
        {members.map((m) => {
          const isMe = m.username === me;
          return (
            <li key={m.username} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-2.5 text-sm">
                    <span className="text-white">{m.username}</span>
                    <span
                      className={`text-[0.65rem] tracking-[0.12em] uppercase ${
                        m.role === "admin" ? "text-lime" : "text-grey-dim"
                      }`}
                    >
                      {m.role}
                    </span>
                    {isMe && (
                      <span className="text-[0.65rem] tracking-[0.12em] text-grey-dim uppercase">
                        you
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-grey-dim">
                    added {when(m.createdAt)} &middot; last in {when(m.lastLoginAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy === m.username}
                    onClick={() =>
                      setResetting(resetting === m.username ? null : m.username)
                    }
                    className="font-display rounded-sm border border-white/15 px-3 py-1.5 text-[0.68rem] tracking-[0.1em] text-grey hover:border-lime hover:text-lime disabled:opacity-50"
                  >
                    Reset password
                  </button>

                  {!isMe && (
                    <button
                      type="button"
                      disabled={busy === m.username}
                      onClick={() =>
                        call(
                          "PATCH",
                          {
                            username: m.username,
                            role: m.role === "admin" ? "staff" : "admin",
                          },
                          m.username,
                        )
                      }
                      className="font-display rounded-sm border border-white/15 px-3 py-1.5 text-[0.68rem] tracking-[0.1em] text-grey hover:border-lime hover:text-lime disabled:opacity-50"
                    >
                      Make {m.role === "admin" ? "staff" : "admin"}
                    </button>
                  )}

                  {!isMe &&
                    (confirming === m.username ? (
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={busy === m.username}
                          onClick={() =>
                            call("DELETE", { username: m.username }, m.username, () =>
                              setConfirming(null),
                            )
                          }
                          className="font-display rounded-sm bg-pink px-3 py-1.5 text-[0.68rem] tracking-[0.1em] text-white disabled:opacity-50"
                        >
                          Remove for good
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="text-[0.68rem] text-grey-dim hover:text-white"
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(m.username)}
                        className="font-display rounded-sm border border-white/15 px-3 py-1.5 text-[0.68rem] tracking-[0.1em] text-grey hover:border-pink hover:text-pink"
                      >
                        Remove
                      </button>
                    ))}
                </div>
              </div>

              {resetting === m.username && (
                <form
                  className="mt-4 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    call("PATCH", { username: m.username, password: resetTo }, m.username, () => {
                      setNotice(
                        `New password set for "${m.username}". Give it to them now - it cannot be read back.`,
                      );
                      setResetting(null);
                      setResetTo("");
                    });
                  }}
                >
                  <input
                    aria-label={`New password for ${m.username}`}
                    className={`${field} max-w-xs`}
                    placeholder="new password"
                    value={resetTo}
                    onChange={(e) => setResetTo(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setResetTo(suggestPassword())}
                    className="font-display rounded-sm border border-white/15 px-3 py-2.5 text-[0.68rem] tracking-[0.1em] text-grey hover:border-lime hover:text-lime"
                  >
                    Suggest
                  </button>
                  <button
                    type="submit"
                    disabled={busy === m.username}
                    className="font-display rounded-sm bg-lime px-4 py-2.5 text-[0.68rem] tracking-[0.1em] text-ink disabled:opacity-60"
                  >
                    Set
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-grey-dim">
        Removing someone takes effect at once, even if they are signed in on
        another screen: the next thing they touch signs them out. Changing
        someone between Staff and Admin is immediate in the same way.
      </p>
    </div>
  );
}
