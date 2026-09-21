export type BookingInput = {
  sessionId: string;
  date: string;
  name: string;
  phone: string;
  capacity: number;
};

export type BookingResult =
  | { ok: true; spotsLeft: number }
  | { ok: false; reason: "full" | "duplicate" };

/** A row as staff see it. Carries personal data - never expose it publicly. */
export type BookingRow = {
  id: string;
  sessionId: string;
  date: string;
  name: string;
  phone: string;
  createdAt: string;
  /** Set when staff cancelled it. The row is kept either way. */
  cancelledAt: string | null;
};

export type CancelResult = { ok: true } | { ok: false; reason: "not-found" };

export type RestoreResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "full" };

export interface BookingStore {
  /** Places taken per "sessionId|date". Cancelled bookings do not count. */
  counts(from: string, to: string): Promise<Record<string, number>>;
  book(input: BookingInput): Promise<BookingResult>;
  /** Every booking in the range, cancelled ones included. Staff view only. */
  list(from: string, to: string): Promise<BookingRow[]>;
  /** One booking by id, or null. */
  get(id: string): Promise<BookingRow | null>;
  /** Soft cancel: frees the place, keeps the record. */
  cancel(id: string): Promise<CancelResult>;
  /** Undo a cancellation, if the class has not filled up since. */
  restore(id: string, capacity: number): Promise<RestoreResult>;
  readonly name: string;
}
