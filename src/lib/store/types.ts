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

/** The "Start here" form on the contact section. */
export type LeadInput = {
  name: string;
  phone: string;
  email: string;
  goal: string;
};

/** An enquiry as staff see it. Personal data - never expose it publicly. */
export type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  goal: string;
  createdAt: string;
  /** Set once staff have dealt with it. The row is kept either way. */
  handledAt: string | null;
};

/** A staff account. The hash is scrypt - see lib/staff/password.ts. */
export type StaffUser = {
  username: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
};

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

  /** Record an enquiry from the "Start here" form. */
  saveLead(input: LeadInput): Promise<{ ok: true; id: string }>;
  /** Every enquiry, newest first. Staff view only. */
  listLeads(limit?: number): Promise<LeadRow[]>;
  /** Tick an enquiry off, or put it back on the list. */
  setLeadHandled(id: string, handled: boolean): Promise<{ ok: boolean }>;

  /** One staff account by username, or null. */
  findStaffUser(username: string): Promise<StaffUser | null>;
  /** Create an account, or reset an existing one's password. */
  upsertStaffUser(username: string, passwordHash: string): Promise<void>;
  /** Every account, without password hashes being useful to anyone. */
  listStaffUsers(): Promise<StaffUser[]>;
  /** Stamp a successful sign-in. */
  touchStaffLogin(username: string): Promise<void>;
  /** Remove an account. Returns false if there was nothing to remove. */
  deleteStaffUser(username: string): Promise<boolean>;

  readonly name: string;
}
