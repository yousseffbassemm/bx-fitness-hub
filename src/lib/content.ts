import type { StaticImageData } from "next/image";
import { coaches as defaultCoaches, plans as defaultPlans } from "./site";
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

export type EditableCoach = {
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
    const fromCode = defaultCoaches.find((d) => d.name === c.name);
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
  return saved?.length ? saved : defaultCoachValues();
}

export async function saveCoaches(next: EditableCoach[], editedBy: string) {
  const clean = next
    .map((c) => ({
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
