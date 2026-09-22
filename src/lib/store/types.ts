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

/**
 * What an account is allowed to do.
 *
 * `staff` is the day job: the bookings and the enquiries. `admin` adds the
 * team screen - creating accounts, resetting passwords, removing people - so
 * that the person who can revoke a colleague's access is a deliberate choice
 * rather than everyone who has ever been given a login.
 */
export type StaffRole = "admin" | "staff";

/** A staff account. The hash is scrypt - see lib/staff/password.ts. */
export type StaffUser = {
  username: string;
  role: StaffRole;
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
  upsertStaffUser(
    username: string,
    passwordHash: string,
    role?: StaffRole,
  ): Promise<void>;
  /** Change what an account is allowed to do. */
  setStaffRole(username: string, role: StaffRole): Promise<boolean>;
  /** Every account, without password hashes being useful to anyone. */
  listStaffUsers(): Promise<StaffUser[]>;
  /** Stamp a successful sign-in. */
  touchStaffLogin(username: string): Promise<void>;
  /** Remove an account. Returns false if there was nothing to remove. */
  deleteStaffUser(username: string): Promise<boolean>;

  /**
   * Editable site content, as JSON under a key.
   *
   * One table rather than one per section: prices, coaches and the timetable
   * are all "a piece of the page someone at the gym needs to change without
   * a developer", and they differ only in shape. Reading returns null when
   * nothing has been set, and the caller falls back to what is in the code.
   */
  getContent<T>(key: string): Promise<T | null>;
  setContent(key: string, value: unknown, editedBy: string): Promise<void>;

  readonly name: string;
}
