import { plans as defaultPlans } from "./site";
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
