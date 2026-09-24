import { unconfiguredHostError } from "./host-check";
import { memoryStore } from "./memory";
import { supabaseConfigured, supabaseStore } from "./supabase";
import type { BookingStore } from "./types";

/**
 * Supabase when it is configured, otherwise SQLite on disk.
 *
 * Resolved lazily because node:sqlite does not exist on every runtime, and
 * a static import of it would break the build where it is missing. The
 * memory store is a last resort only - it loses every booking on restart,
 * so it says so when it is picked.
 */
let cached: Promise<BookingStore> | null = null;

export function getStore(): Promise<BookingStore> {
  cached ??= (async () => {
    const wrong = unconfiguredHostError(process.env, supabaseConfigured);
    if (wrong) {
      // Into the host's log, where somebody looking at a broken deploy will
      // actually find it - report() writes to the database, which is the
      // very thing that is missing.
      console.error(`[bx] ${wrong}`);
      throw new Error(wrong);
    }

    if (supabaseConfigured) return supabaseStore;

    try {
      const { sqliteStore } = await import("./sqlite");
      return sqliteStore;
    } catch (error) {
      console.warn(
        "[bx] node:sqlite unavailable, falling back to the in-memory store. " +
          "Bookings will NOT survive a restart.",
        error,
      );
      return memoryStore;
    }
  })();

  return cached;
}

export type { BookingResult, BookingStore } from "./types";
