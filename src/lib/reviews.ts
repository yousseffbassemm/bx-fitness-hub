import { report } from "./report";
import { reviews as snapshot, site, type Review } from "./site";
import { getStore } from "./store";

/**
 * Google reviews, live where that is configured and from the snapshot where
 * it is not.
 *
 * The twelve in site.ts were read by hand on 22 September 2026. They are real
 * and quoted in full, but they are a photograph of one afternoon: new reviews
 * never appear, and a review the author later edits or deletes stays on the
 * site. The Places API fixes both.
 *
 * Two things constrain how this is written. Google's terms allow caching the
 * content of a place for a limited period, so the cache has a deliberate
 * expiry rather than living forever. And Places charges per request, so the
 * marketing page must not call it on every render - which it will not, being
 * prerendered, but a cache is the honest belt to that braces.
 *
 * Note the ceiling: the Places API returns at most five reviews, chosen by
 * Google, and gives no way to ask for more. So this trades twelve curated
 * five-star reviews for five live ones that may include a bad one. That is a
 * real decision about the gym's shopfront, not a technical detail - see the
 * README.
 */

const CACHE_KEY = "google-reviews";

/** Google permits caching place content for a limited period. Stay well under. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Cached = {
  fetchedAt: number;
  reviews: Review[];
  rating: number | null;
  total: number | null;
};

export function placesConfigured() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY && process.env.GOOGLE_PLACE_ID);
}

type PlacesReview = {
  text?: { text?: string };
  originalText?: { text?: string };
  rating?: number;
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string };
};

async function fetchFromGoogle(): Promise<Cached | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const id = process.env.GOOGLE_PLACE_ID;
  if (!key || !id) return null;

  const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
    headers: {
      "X-Goog-Api-Key": key,
      // Only the fields used, because Places bills by what you ask for.
      "X-Goog-FieldMask": "rating,userRatingCount,reviews",
    },
    /*
      Not cache: "no-store". That marks the whole route dynamic, which drops
      the marketing page out of prerendering entirely - a page that exists to
      be fast, made slow, to avoid a cache that is already handled a layer up
      in site_content. A day matches that cache and Google's terms.
    */
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    throw new Error(`Places refused it: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    rating?: number;
    userRatingCount?: number;
    reviews?: PlacesReview[];
  };

  const reviews: Review[] = (data.reviews ?? [])
    .map((r) => ({
      name: r.authorAttribution?.displayName ?? "A member",
      rating: r.rating ?? 5,
      when: r.relativePublishTimeDescription ?? "",
      quote: (r.text?.text ?? r.originalText?.text ?? "").trim(),
      source: "BX Fitness Hub" as const,
    }))
    .filter((r) => r.quote);

  return {
    fetchedAt: Date.now(),
    reviews,
    rating: data.rating ?? null,
    total: data.userRatingCount ?? null,
  };
}

export type ReviewFeed = {
  reviews: Review[];
  rating: number;
  total: number;
  /** True when these came from Google just now rather than from the file. */
  live: boolean;
};

export async function getReviews(): Promise<ReviewFeed> {
  const fallback: ReviewFeed = {
    reviews: [...snapshot],
    rating: site.rating.value,
    total: site.rating.count,
    live: false,
  };

  if (!placesConfigured()) return fallback;

  try {
    const store = await getStore();
    const cached = await store.getContent<Cached>(CACHE_KEY);

    if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS && cached.reviews.length) {
      return {
        reviews: cached.reviews,
        rating: cached.rating ?? site.rating.value,
        total: cached.total ?? site.rating.count,
        live: true,
      };
    }

    const fresh = await fetchFromGoogle();

    // Google returned nothing usable: keep showing the snapshot rather than
    // an empty section.
    if (!fresh?.reviews.length) return fallback;

    await store.setContent(CACHE_KEY, fresh, "google-places");

    return {
      reviews: fresh.reviews,
      rating: fresh.rating ?? site.rating.value,
      total: fresh.total ?? site.rating.count,
      live: true,
    };
  } catch (error) {
    // A quota, a revoked key, a network blip - none of them should empty the
    // reviews section. Fall back and record it.
    await report("google places reviews", error);
    return fallback;
  }
}
