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

export interface BookingStore {
  /** Bookings taken per "sessionId|date", for every date in the range. */
  counts(from: string, to: string): Promise<Record<string, number>>;
  book(input: BookingInput): Promise<BookingResult>;
  readonly name: string;
}
