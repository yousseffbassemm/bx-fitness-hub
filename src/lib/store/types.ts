export type BookingInput = {
  sessionId: string;
  date: string;
  name: string;
  phone: string;
  capacity: number;
};

export type BookingResult =
  | { ok: true; spotsLeft: number; token: string }
  | { ok: false; reason: "full" | "duplicate" };

/** A row as staff see it. Carries personal data - never expose it publicly. */
export type BookingRow = {
  id: string;
  sessionId: string;
  date: string;
  name: string;
  phone: string;
  createdAt: string;
  /** Set when it was cancelled, by staff or by the member. Row is kept. */
  cancelledAt: string | null;
  /**
   * The member's own handle on this booking.
   *
   * Unguessable and specific to one booking, so someone can cancel their own
   * place without an account and without being able to reach anyone else's.
   * Null on bookings taken before self-cancelling existed.
   */
  token: string | null;
  /** Promoted from the waitlist and not yet told. */
  promotedAt: string | null;
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

/** Someone waiting for a place on a class that was full. */
export type WaitlistRow = {
  id: string;
  sessionId: string;
  date: string;
  name: string;
  phone: string;
  createdAt: string;
  /** Set when a place freed and this entry became a booking. */
  promotedAt: string | null;
};

export interface BookingStore {
  /** Places taken per "sessionId|date". Cancelled bookings do not count. */
  counts(from: string, to: string): Promise<Record<string, number>>;
  book(input: BookingInput): Promise<BookingResult>;
  /** Every booking in the range, cancelled ones included. Staff view only. */
  list(from: string, to: string): Promise<BookingRow[]>;
  /** One booking by id, or null. */
  get(id: string): Promise<BookingRow | null>;
  /** One booking by the member's own token, or null. */
  getByToken(token: string): Promise<BookingRow | null>;
  /** Soft cancel: frees the place, keeps the record. */
  cancel(id: string): Promise<CancelResult>;
  /** Undo a cancellation, if the class has not filled up since. */
  restore(id: string, capacity: number): Promise<RestoreResult>;

  /** Put someone on the waitlist for a class that is full. */
  joinWaitlist(input: Omit<BookingInput, "capacity">): Promise<
    { ok: true; position: number } | { ok: false; reason: "duplicate" }
  >;
  /** Everyone waiting, oldest first, for a date range. Staff view only. */
  listWaitlist(from: string, to: string): Promise<WaitlistRow[]>;
  /**
   * Turn the longest-waiting entry for a slot into a booking, if there is
   * room. Called when a place frees.
   */
  promoteFromWaitlist(
    sessionId: string,
    date: string,
    capacity: number,
  ): Promise<BookingRow | null>;
  /** Bookings that came off the waitlist and still need telling. */
  listPromoted(from: string, to: string): Promise<BookingRow[]>;
  /** Mark a promoted booking as told. */
  markTold(id: string): Promise<void>;

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

  /**
   * Uploaded images, stored as bytes rather than written to disk.
   *
   * A filesystem is not something every host gives you - on a serverless
   * platform the disk is read-only and anything written to it vanishes with
   * the instance - so an upload that must outlive a deploy belongs in the
   * same store as everything else. The id is a hash of the content, which
   * makes the URL safe to cache forever and makes uploading the same file
   * twice a no-op.
   */
  saveUpload(id: string, mime: string, bytes: Uint8Array): Promise<void>;
  getUpload(id: string): Promise<{ mime: string; bytes: Uint8Array } | null>;

  readonly name: string;
}
