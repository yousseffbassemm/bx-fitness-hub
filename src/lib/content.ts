import type { StaticImageData } from "next/image";
import { sessionId } from "./booking";
import {
  coaches as defaultCoaches,
  facilities as defaultFacilities,
  gallery as defaultGallery,
  plans as defaultPlans,
  schedule as defaultSchedule,
  type Session,
} from "./site";
import { getStore } from "./store";

/**
 * Pieces of the site that someone at the gym can change without a developer.
 *
 * Everything here follows one shape: what is in the code is the default, and
 * a row in site_content overrides it. That means a fresh clone renders
 * correctly with nothing in the database, the site cannot be broken by an
 * empty table, and anything not yet editable simply keeps using the code.
 */

export type EditablePlan = {
  /** Matches the name in site.ts - this is what ties an override to a plan. */
  name: string;
  price: string;
  period: string;
  blurb: string;
};

export type Plan = EditablePlan & {
  perks: readonly string[];
  featured: boolean;
};

const PLANS_KEY = "plans";

/** The prices as they are in the code, before any edit. */
export function defaultPlanValues(): EditablePlan[] {
  return defaultPlans.map((p) => ({
    name: p.name,
    price: p.price,
    period: p.period,
    blurb: p.blurb,
  }));
}

/**
 * The plans to render.
 *
 * Only price, period and blurb are editable. The perks are real, checked
 * benefits and the layout depends on which plan is featured, so both stay in
 * the code where they are reviewed rather than in a form where they are not.
 */
export async function getPlans(): Promise<Plan[]> {
  let saved: EditablePlan[] | null = null;

  try {
    saved = await (await getStore()).getContent<EditablePlan[]>(PLANS_KEY);
  } catch {
    // A database that is unreachable must not take the marketing page with
    // it: fall back to the code.
    saved = null;
  }

  return defaultPlans.map((plan) => {
    const edit = saved?.find((p) => p.name === plan.name);
    return {
      name: plan.name,
      price: edit?.price?.trim() || plan.price,
      period: edit?.period?.trim() || plan.period,
      blurb: edit?.blurb?.trim() || plan.blurb,
      perks: plan.perks,
      featured: plan.featured,
    };
  });
}

/** What the editing screen shows: saved values where they exist. */
export async function getEditablePlans(): Promise<EditablePlan[]> {
  const merged = await getPlans();
  return merged.map(({ name, price, period, blurb }) => ({
    name,
    price,
    period,
    blurb,
  }));
}

export async function savePlans(next: EditablePlan[], editedBy: string) {
  // Only names that exist in the code are kept, so a stale or hand-made
  // payload cannot introduce a plan the page does not know how to render.
  // Widened to string: `plans` is `as const`, so its names are a literal
  // union and a Set of them will not take an arbitrary string to test.
  const known = new Set<string>(defaultPlans.map((p) => p.name));
  const clean = next
    .filter((p) => known.has(p.name))
    .map((p) => ({
      name: p.name,
      price: String(p.price ?? "").trim().slice(0, 60),
      period: String(p.period ?? "").trim().slice(0, 60),
      blurb: String(p.blurb ?? "").trim().slice(0, 160),
    }));

  await (await getStore()).setContent(PLANS_KEY, clean, editedBy);
}


/* -------------------------------------------------------------------------
   Coaches
   ---------------------------------------------------------------------- */

/*
   Which built-in item a saved row started as.

   The photograph for a coach, a facility and a gallery tile lives in the
   code, and a saved row with no uploaded photo of its own borrows it. What
   tied the two together was the row's own visible text - a coach's name, a
   facility's title, a photo's description - which is also the text staff
   are invited to edit. So the identity changed whenever the wording did,
   and the save was refused with a message about a new item needing a
   photo. Nobody had added anything; they had corrected a typo.

   This remembers it instead. Rows saved before this existed have no `base`,
   so it is worked out from their text when the editor loads them, which is
   safe precisely because the old rule made it impossible to save a row
   whose text had drifted. From then on the wording is just wording.
   ---------------------------------------------------------------------- */
type Based = { base?: string | null };

/** The built-in identity of a row, however it was recorded. */
const baseOf = (row: Based & Record<string, unknown>, textField: string) =>
  typeof row.base === "string" && row.base
    ? row.base
    : String(row[textField] ?? "").trim();

export type EditableCoach = Based & {
  name: string;
  credential: string;
  disciplines: string[];
  /** Id of an uploaded image, or null to keep using the one in the code. */
  photoId: string | null;
  /**
   * object-position for the crop, e.g. "center 30%".
   *
   * The cards are a tall, fixed shape and the portraits are not. Without
   * this, every new photograph is a coin toss between a good crop and one
   * that cuts someone off at the eyebrows - and fixing that used to mean a
   * developer editing a file.
   */
  focus: string;
};

export type Coach = {
  name: string;
  credential: string;
  disciplines: string[];
  /** Either an uploaded photo's URL or an imported image from the code. */
  photo: string | StaticImageData;
  focus: string;
};

const COACHES_KEY = "coaches";

/** Where an uploaded image is served from. */
export const uploadUrl = (id: string) => `/api/photo/${id}`;

/** The coaches as they are in the code, for seeding the editor. */
export function defaultCoachValues(): EditableCoach[] {
  return defaultCoaches.map((c) => ({
    base: c.name,
    name: c.name,
    credential: c.credential,
    disciplines: [...c.disciplines],
    photoId: null,
    focus: "center top",
  }));
}

export async function getCoaches(): Promise<Coach[]> {
  let saved: EditableCoach[] | null = null;

  try {
    saved = await (await getStore()).getContent<EditableCoach[]>(COACHES_KEY);
  } catch {
    saved = null;
  }

  // Nothing saved: the code is the site.
  if (!saved?.length) {
    return defaultCoaches.map((c) => ({
      name: c.name,
      credential: c.credential,
      disciplines: [...c.disciplines],
      photo: c.photo,
      focus: "center top",
    }));
  }

  /*
    Saved coaches replace the list rather than merging into it, because the
    list itself is the thing being edited - people are added, removed and
    reordered. A coach still carrying no uploaded photo falls back to the
    image in the code, matched by name, so the team can be reordered or
    renamed without every portrait having to be re-uploaded first.
  */
  return saved.map((c) => {
    const base = baseOf(c, "name");
    const fromCode = defaultCoaches.find((d) => d.name === base);
    return {
      name: c.name,
      credential: c.credential,
      disciplines: c.disciplines,
      photo: c.photoId ? uploadUrl(c.photoId) : (fromCode?.photo ?? ""),
      focus: c.focus || "center top",
    };
  });
}

/** What the editing screen shows. */
export async function getEditableCoaches(): Promise<EditableCoach[]> {
  let saved: EditableCoach[] | null = null;
  try {
    saved = await (await getStore()).getContent<EditableCoach[]>(COACHES_KEY);
  } catch {
    saved = null;
  }
  if (!saved?.length) return defaultCoachValues();
  // Stamp the identity onto rows saved before it was recorded, so the next
  // save keeps it and the name becomes free to change. Field order matches
  // saveCoaches: the screens compare this against their own draft as JSON.
  return saved.map((c) => ({
    base: baseOf(c, "name"),
    name: c.name,
    credential: c.credential,
    disciplines: c.disciplines,
    photoId: c.photoId,
    focus: c.focus,
  }));
}

export async function saveCoaches(next: EditableCoach[], editedBy: string) {
  const clean = next
    .map((c) => ({
      base: typeof c.base === "string" && c.base ? c.base : null,
      name: String(c.name ?? "").trim().slice(0, 60),
      credential: String(c.credential ?? "").trim().slice(0, 80),
      disciplines: (Array.isArray(c.disciplines) ? c.disciplines : [])
        .map((d) => String(d).trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 6),
      photoId: typeof c.photoId === "string" && c.photoId ? c.photoId : null,
      focus: String(c.focus ?? "center top").trim().slice(0, 40),
    }))
    // A coach with no name is a row someone started and abandoned.
    .filter((c) => c.name);

  await (await getStore()).setContent(COACHES_KEY, clean, editedBy);
}


/* -------------------------------------------------------------------------
   Timetable

   The one piece here where an edit can reach something a member has already
   done. A booking stores a session id, and until now that id was *derived*
   from the day, the time and the discipline - so moving Boxing from 7pm to
   8pm would have silently changed its id, left every booking for it pointing
   at nothing, and dropped those people off the staff list without a word.

   So a saved session carries its own id, fixed at the moment it is created
   and untouched by later edits. The ids seeded from the code are exactly the
   ones the old derivation produced, so bookings taken before any of this
   still resolve.
   ---------------------------------------------------------------------- */

export type EditableSession = Session & { id: string };

export type ScheduleDay = {
  day: string;
  short: string;
  sessions: EditableSession[];
};

const SCHEDULE_KEY = "schedule";

/** The timetable as it is in the code, with ids matching the old derivation. */
export function defaultScheduleValues(): ScheduleDay[] {
  return defaultSchedule.map((d, i) => ({
    day: d.day,
    short: d.short,
    sessions: d.sessions.map((s) => ({ ...s, id: sessionId(i, s) })),
  }));
}

export async function getSchedule(): Promise<ScheduleDay[]> {
  let saved: ScheduleDay[] | null = null;

  try {
    saved = await (await getStore()).getContent<ScheduleDay[]>(SCHEDULE_KEY);
  } catch {
    saved = null;
  }

  if (!saved?.length) return defaultScheduleValues();

  // The seven rows are the week and are not editable; only what is in them
  // is. Taking the day names from the code keeps a saved timetable from
  // inventing an eighth day or losing Tuesday.
  return defaultSchedule.map((d, i) => ({
    day: d.day,
    short: d.short,
    sessions: (saved[i]?.sessions ?? []).map((s) => ({
      id: s.id,
      time: s.time,
      coach: s.coach,
      discipline: s.discipline,
      ...(s.ladiesOnly ? { ladiesOnly: true as const } : {}),
    })),
  }));
}

export async function saveSchedule(next: ScheduleDay[], editedBy: string) {
  const seen = new Set<string>();

  const clean = defaultSchedule.map((d, i) => ({
    day: d.day,
    short: d.short,
    sessions: (next[i]?.sessions ?? [])
      .map((s) => {
        // A session with no id, or one that collides, is a new session. Two
        // classes sharing an id would have their bookings run together.
        let id = String(s.id ?? "").trim();
        if (!/^[a-z0-9-]{3,64}$/.test(id) || seen.has(id)) id = newSessionId();
        seen.add(id);

        return {
          id,
          time: String(s.time ?? "").trim().slice(0, 20),
          coach: String(s.coach ?? "").trim().slice(0, 60),
          discipline: String(s.discipline ?? "").trim().slice(0, 60),
          ...(s.ladiesOnly ? { ladiesOnly: true as const } : {}),
        };
      })
      .filter((s) => s.time && s.discipline),
  }));

  await (await getStore()).setContent(SCHEDULE_KEY, clean, editedBy);
}

/** An id for a brand new class. Random, so it never collides with a derived one. */
export function newSessionId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `s-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}


/* -------------------------------------------------------------------------
   Facilities and the gallery

   Both are the same thing in different clothes - a photograph with words
   attached - so they share the upload machinery the coaches use. Each item
   keeps a photoId when one has been uploaded and falls back to the image in
   the code by position when it has not, which is what lets the captions be
   edited before anyone has re-shot anything.
   ---------------------------------------------------------------------- */

export type EditableFacility = Based & {
  title: string;
  copy: string;
  alt: string;
  photoId: string | null;
  focus: string;
};

export type FacilityItem = Omit<EditableFacility, "photoId"> & {
  photo: string | StaticImageData;
};

const FACILITIES_KEY = "facilities";

export function defaultFacilityValues(): EditableFacility[] {
  return defaultFacilities.map((f) => ({
    base: f.title,
    title: f.title,
    copy: f.copy,
    alt: f.alt,
    photoId: null,
    focus: f.focus ?? "center",
  }));
}

export async function getFacilities(): Promise<FacilityItem[]> {
  let saved: EditableFacility[] | null = null;
  try {
    saved = await (await getStore()).getContent<EditableFacility[]>(FACILITIES_KEY);
  } catch {
    saved = null;
  }

  if (!saved?.length) {
    return defaultFacilities.map((f) => ({
      title: f.title,
      copy: f.copy,
      alt: f.alt,
      photo: f.image,
      focus: f.focus ?? "center",
    }));
  }

  /*
    A facility with no uploaded photo borrows the one from the code, matched
    by title - the same way coaches are matched by name.

    It used to be matched by position, which quietly came apart the moment
    anyone used the Up and Down buttons on the Facilities screen: every card
    here is seeded with photoId null, so the text moved and the photographs
    stayed where they were, leaving each card wearing its neighbour's.
  */
  return saved.map((f, i) => {
    const base = baseOf(f, "title");
    const fromCode =
      defaultFacilities.find((d) => d.title === base) ?? defaultFacilities[i];
    return {
      title: f.title,
      copy: f.copy,
      alt: f.alt,
      photo: f.photoId ? uploadUrl(f.photoId) : (fromCode?.image ?? ""),
      focus: f.focus || "center",
    };
  });
}

export async function getEditableFacilities(): Promise<EditableFacility[]> {
  let saved: EditableFacility[] | null = null;
  try {
    saved = await (await getStore()).getContent<EditableFacility[]>(FACILITIES_KEY);
  } catch {
    saved = null;
  }
  if (!saved?.length) return defaultFacilityValues();
  return saved.map((f) => ({
    base: baseOf(f, "title"),
    title: f.title,
    copy: f.copy,
    alt: f.alt,
    photoId: f.photoId,
    focus: f.focus,
  }));
}

export async function saveFacilities(next: EditableFacility[], editedBy: string) {
  const clean = next
    .map((f) => ({
      base: typeof f.base === "string" && f.base ? f.base : null,
      title: String(f.title ?? "").trim().slice(0, 60),
      copy: String(f.copy ?? "").trim().slice(0, 200),
      alt: String(f.alt ?? "").trim().slice(0, 200),
      photoId: typeof f.photoId === "string" && f.photoId ? f.photoId : null,
      focus: String(f.focus ?? "center").trim().slice(0, 40),
    }))
    .filter((f) => f.title);

  await (await getStore()).setContent(FACILITIES_KEY, clean, editedBy);
}

export type GalleryRatio = "tall" | "square";

export type EditableGalleryItem = Based & {
  alt: string;
  ratio: GalleryRatio;
  photoId: string | null;
};

export type GalleryItem = {
  alt: string;
  ratio: GalleryRatio;
  src: string | StaticImageData;
};

const GALLERY_KEY = "gallery";

export function defaultGalleryValues(): EditableGalleryItem[] {
  return defaultGallery.map((g) => ({
    base: g.alt,
    alt: g.alt,
    ratio: g.ratio === "tall" ? "tall" : "square",
    photoId: null,
  }));
}

export async function getGallery(): Promise<GalleryItem[]> {
  let saved: EditableGalleryItem[] | null = null;
  try {
    saved = await (await getStore()).getContent<EditableGalleryItem[]>(GALLERY_KEY);
  } catch {
    saved = null;
  }

  if (!saved?.length) {
    return defaultGallery.map((g) => ({
      alt: g.alt,
      ratio: g.ratio === "tall" ? ("tall" as const) : ("square" as const),
      src: g.src,
    }));
  }

  // Matched by its description rather than its position, for the reason
  // getFacilities gives: the mosaic can be reordered, and seven of these
  // eight carry no uploaded photo of their own.
  return saved.map((g, i) => {
    const base = baseOf(g, "alt");
    const fromCode = defaultGallery.find((d) => d.alt === base) ?? defaultGallery[i];
    return {
      alt: g.alt,
      ratio: g.ratio === "tall" ? ("tall" as const) : ("square" as const),
      src: g.photoId ? uploadUrl(g.photoId) : (fromCode?.src ?? ""),
    };
  });
}

export async function getEditableGallery(): Promise<EditableGalleryItem[]> {
  let saved: EditableGalleryItem[] | null = null;
  try {
    saved = await (await getStore()).getContent<EditableGalleryItem[]>(GALLERY_KEY);
  } catch {
    saved = null;
  }
  if (!saved?.length) return defaultGalleryValues();
  return saved.map((g) => ({
    base: baseOf(g, "alt"),
    alt: g.alt,
    ratio: g.ratio,
    photoId: g.photoId,
  }));
}

export async function saveGallery(next: EditableGalleryItem[], editedBy: string) {
  const clean = next
    .map((g) => ({
      base: typeof g.base === "string" && g.base ? g.base : null,
      alt: String(g.alt ?? "").trim().slice(0, 200),
      ratio: g.ratio === "tall" ? ("tall" as const) : ("square" as const),
      photoId: typeof g.photoId === "string" && g.photoId ? g.photoId : null,
    }))
    // Something with no picture and no description is a row someone abandoned.
    .filter((g) => g.photoId || g.alt);

  await (await getStore()).setContent(GALLERY_KEY, clean, editedBy);
}
