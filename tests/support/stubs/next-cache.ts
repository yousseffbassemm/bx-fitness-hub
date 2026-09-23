/**
 * revalidatePath, outside a request.
 *
 * The real one needs Next's per-request store and throws without it. What a
 * test wants to know is that it was called at all: the marketing page is
 * prerendered, so a price that changes in the database and never tells Next
 * the page is stale goes on showing the old one until the next deploy.
 */
export const revalidated: string[] = [];

export function revalidatePath(pathname: string) {
  revalidated.push(pathname);
}

export function revalidateTag(tag: string) {
  revalidated.push(tag);
}

export function unstable_cache<T>(fn: T) {
  return fn;
}
