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
  sessionId: string;
  date: string;
  name: string;
  phone: string;
  createdAt: string;
};

export interface BookingStore {
  /** Bookings taken per "sessionId|date", for every date in the range. */
  counts(from: string, to: string): Promise<Record<string, number>>;
  book(input: BookingInput): Promise<BookingResult>;
  /** Every booking in the range, oldest first. Staff view only. */
  list(from: string, to: string): Promise<BookingRow[]>;
  readonly name: string;
}
