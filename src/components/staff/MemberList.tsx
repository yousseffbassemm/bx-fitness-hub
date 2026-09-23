"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Member } from "@/lib/store/types";

const field =
  "w-full rounded-sm border border-white/15 bg-ink px-3 py-2.5 text-base text-white placeholder:text-grey-dim focus:border-lime focus:outline-none sm:text-sm";

/**
 * The membership list.
 *
 * Two things have to be right here or booking breaks for the member: the
 * number and the phone. Those are the two things they can prove themselves
 * with, so the screen puts them first and says so.
 */
export default function MemberList({ members }: { members: Member[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [draft, setDraft] = useState({ memberNo: "", name: "", phone: "" });
  const [pasted, setPasted] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");

  async function send(method: string, body: unknown) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/staff/members", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That did not work.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Could not reach the gym's records. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (await send("POST", draft)) {
      setDraft({ memberNo: "", name: "", phone: "" });
      setNote(`Added ${draft.name.trim()}.`);
    }
  }

  async function save(id: string) {
    if (await send("PATCH", { id, ...draft })) {
      setEditing(null);
      setNote("Saved.");
    }
  }

  /*
    A pasted list, one member per line: "number, name, phone" or just
    "name, phone". Tabs count as commas, so a column copied straight out of
    a spreadsheet lands without being reformatted first.
  */
  function parse(text: string) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[\t,;]/).map((p) => p.trim());
        return parts.length >= 3
          ? { memberNo: parts[0], name: parts[1], phone: parts[2] }
          : { memberNo: "", name: parts[0] ?? "", phone: parts[1] ?? "" };
      })
      .filter((r) => r.name && r.phone);
  }

  async function importAll() {
    const rows = parse(pasted);
    if (!rows.length) return setError("Nothing in there looked like a member.");

    setBusy(true);
    setError(null);
    let added = 0;
    const failed: string[] = [];
    for (const row of rows) {
      const res = await fetch("/api/staff/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (res.ok) added += 1;
      else failed.push(row.name);
    }
    setBusy(false);
    setPasted("");
    setShowImport(false);
    // Said plainly, including what did not land: a silent partial import is
    // how a list ends up half true.
    setNote(
      failed.length
        ? `Added ${added}. These were not added, most likely a repeated number: ${failed.join(", ")}`
        : `Added ${added}.`,
    );
    router.refresh();
  }

  const shown = members.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [m.name, m.phone, m.memberNo ?? ""].some((v) => v.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-line bg-charcoal/40 p-5">
        <p className="kicker mb-3">Add a member</p>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_12rem_auto]">
          <input
            aria-label="Membership number"
            value={draft.memberNo}
            onChange={(e) => setDraft({ ...draft, memberNo: e.target.value })}
            className={field}
            placeholder="Number"
            disabled={!!editing}
          />
          <input
            aria-label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className={field}
            placeholder="Full name"
            disabled={!!editing}
          />
          <input
            aria-label="Phone"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            className={field}
            placeholder="010 0000 0000"
            disabled={!!editing}
          />
          <button
            type="button"
            onClick={add}
            disabled={busy || !!editing}
            className="font-display rounded-sm bg-lime px-5 py-2.5 text-[0.78rem] tracking-[0.12em] text-ink disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <p className="mt-3 text-xs text-grey-dim">
          The number is optional. Without one they book with their phone, so
          the phone has to be the one they will type.
        </p>

        <button
          type="button"
          onClick={() => setShowImport(!showImport)}
          className="mt-4 text-xs text-grey underline-offset-4 hover:text-lime hover:underline"
        >
          {showImport ? "Never mind" : "Paste a list instead"}
        </button>

        {showImport && (
          <div className="mt-4 border-t border-line pt-4">
            <label htmlFor="member-import" className="kicker mb-2 block">
              One per line
            </label>
            <textarea
              id="member-import"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={6}
              className={field}
              placeholder={"BX-0142, Karma Wael, 010 0000 0000\nNourhan Kamal, 010 0000 0001"}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={importAll}
                disabled={busy}
                className="font-display rounded-sm bg-lime px-5 py-2.5 text-[0.78rem] tracking-[0.12em] text-ink disabled:opacity-50"
              >
                {busy ? "Adding…" : `Add ${parse(pasted).length}`}
              </button>
              <span className="text-xs text-grey-dim">
                Number, name, phone &mdash; or just name and phone. Commas or tabs.
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-pink">
          {error}
        </p>
      )}
      {note && <p className="text-sm text-lime">{note}</p>}

      {members.length > 6 && (
        <input
          aria-label="Search members"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={field}
          placeholder="Search by name, number or phone"
        />
      )}

      <div className="rounded-sm border border-line">
        {shown.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-grey-dim">
            {members.length ? "Nobody matches that." : "No members yet."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((m) => (
              <li key={m.id} className="px-5 py-4">
                {editing === m.id ? (
                  <div className="grid gap-3 sm:grid-cols-[10rem_1fr_12rem_auto_auto]">
                    <input
                      aria-label="Membership number"
                      value={draft.memberNo}
                      onChange={(e) => setDraft({ ...draft, memberNo: e.target.value })}
                      className={field}
                    />
                    <input
                      aria-label="Name"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className={field}
                    />
                    <input
                      aria-label="Phone"
                      value={draft.phone}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                      className={field}
                    />
                    <button
                      type="button"
                      onClick={() => save(m.id)}
                      disabled={busy}
                      className="font-display rounded-sm bg-lime px-4 py-2.5 text-[0.72rem] tracking-[0.1em] text-ink"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="font-display px-2 text-[0.72rem] tracking-[0.1em] text-grey hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="flex flex-wrap items-baseline gap-2.5 text-sm">
                        <span className="text-white">{m.name}</span>
                        {m.memberNo && (
                          <span className="font-display text-[0.7rem] tracking-[0.1em] text-lime">
                            {m.memberNo}
                          </span>
                        )}
                        {m.endedAt && (
                          <span className="font-display text-[0.7rem] tracking-[0.1em] text-grey-dim uppercase">
                            Lapsed
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-grey-dim">{m.phone}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(m.id);
                          setConfirming(null);
                          setDraft({
                            memberNo: m.memberNo ?? "",
                            name: m.name,
                            phone: m.phone,
                          });
                        }}
                        className="font-display rounded-sm border border-white/15 px-3 py-2 text-[0.68rem] tracking-[0.1em] text-grey hover:border-lime hover:text-lime"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => send("PATCH", { id: m.id, ended: m.endedAt === null })}
                        disabled={busy}
                        className="font-display rounded-sm border border-white/15 px-3 py-2 text-[0.68rem] tracking-[0.1em] text-grey hover:border-white hover:text-white"
                      >
                        {m.endedAt ? "Reinstate" : "Mark lapsed"}
                      </button>
                      {confirming === m.id ? (
                        <>
                          <span className="text-xs text-grey-dim">
                            Remove {m.name.split(" ")[0]}?
                          </span>
                          <button
                            type="button"
                            onClick={() => send("DELETE", { id: m.id })}
                            disabled={busy}
                            className="font-display rounded-sm bg-pink px-3 py-2 text-[0.68rem] tracking-[0.1em] text-white"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            className="font-display px-1 text-[0.68rem] tracking-[0.1em] text-grey hover:text-white"
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirming(m.id)}
                          className="font-display rounded-sm border border-white/15 px-3 py-2 text-[0.68rem] tracking-[0.1em] text-grey hover:border-pink hover:text-pink"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs leading-relaxed text-grey-dim">
        Marking somebody lapsed stops them booking as a member without losing
        anything &mdash; their old bookings still name them, and Reinstate puts
        them back. Removing is for a row that should never have been here.
      </p>
    </div>
  );
}
