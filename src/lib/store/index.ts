import { memoryStore } from "./memory";
import { supabaseConfigured, supabaseStore } from "./supabase";
import type { BookingStore } from "./types";

/**
 * Supabase when it is configured, otherwise the in-process store so the
 * booking flow still works end to end on a fresh clone.
 */
export const store: BookingStore = supabaseConfigured ? supabaseStore : memoryStore;

export type { BookingResult, BookingStore } from "./types";
