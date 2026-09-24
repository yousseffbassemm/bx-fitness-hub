#!/usr/bin/env node
/**
 * Copy the settings this site needs from .env.local into a Vercel project.
 *
 * Run it yourself after `vercel login` and `vercel link`:
 *
 *     node scripts/vercel-env.mjs           # show what it would do
 *     node scripts/vercel-env.mjs --push    # actually set them
 *
 * The values are read from .env.local on this machine and piped straight to
 * the Vercel CLI. They are printed only as a length and a first character,
 * never in full, so this is safe to run with somebody watching.
 *
 * NEXT_PUBLIC_SITE_URL is not in .env.local - it is the address the site ends
 * up on, so pass it: `--site-url https://bx-fitness-hub.vercel.app`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REQUIRED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STAFF_SESSION_SECRET",
  "NEXT_PUBLIC_SITE_URL",
];
const OPTIONAL = ["RESEND_API_KEY", "NOTIFY_EMAIL_TO", "NOTIFY_EMAIL_FROM", "GOOGLE_PLACES_API_KEY", "GOOGLE_PLACE_ID"];

/**
 * Parse a .env file: NAME=value, one per line, # comments and blanks skipped.
 *
 * Quotes around a value are stripped if they wrap the whole thing. Nothing
 * clever beyond that - the file this reads is written by hand, and a parser
 * that guesses is worse than one that is obvious.
 */
function readEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const at = trimmed.indexOf("=");
    if (at < 1) continue;

    const name = trimmed.slice(0, at).trim();
    if (!/^[A-Z0-9_]+$/.test(name)) continue;

    let value = trimmed.slice(at + 1).trim();
    if (
      value.length > 1 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[name] = value;
  }
  return out;
}

const args = process.argv.slice(2);
const push = args.includes("--push");
const siteUrl = args[args.indexOf("--site-url") + 1];

const env = readEnvFile(".env.local");
if (siteUrl && siteUrl !== "--push") env.NEXT_PUBLIC_SITE_URL = siteUrl;

const show = (v) => (v ? `${v.length} chars, starts "${v.slice(0, 4)}…"` : "not set");

let missing = 0;
for (const name of [...REQUIRED, ...OPTIONAL]) {
  const value = env[name];
  const required = REQUIRED.includes(name);

  if (!value) {
    if (required) {
      missing += 1;
      console.error(`  ${name.padEnd(28)} MISSING - required`);
    } else {
      console.log(`  ${name.padEnd(28)} not set, skipping (optional)`);
    }
    continue;
  }

  // A placeholder address is worse than none: email silently goes nowhere
  // and the staff screen is the only thing that knows an enquiry arrived.
  const placeholder =
    name === "NOTIFY_EMAIL_TO" && /^someone@|example\.com$/i.test(value);
  const note = placeholder ? "  <- PLACEHOLDER, nothing will be emailed" : "";

  if (!push) {
    console.log(`  ${name.padEnd(28)} would set: ${show(value)}${note}`);
    continue;
  }
  if (placeholder) console.log(`  ${name.padEnd(28)} ${show(value)}${note}`);

  // The value goes from the file to the CLI's stdin. It is never an argument,
  // so it does not land in the shell history or in a process listing.
  const run = spawnSync("npx", ["vercel", "env", "add", name, "production"], {
    input: value,
    encoding: "utf8",
  });
  const ok = run.status === 0;
  console.log(`  ${name.padEnd(28)} ${ok ? "set" : `FAILED: ${(run.stderr || "").trim().split("\n").pop()}`}`);
  if (!ok) missing += 1;
}

if (!push) {
  console.log("\nNothing was changed. Re-run with --push to set them.");
} else if (missing) {
  console.error(`\n${missing} could not be set.`);
  process.exit(1);
} else {
  console.log("\nAll set. Now: npx vercel --prod");
}

if (missing && !push) process.exit(1);
