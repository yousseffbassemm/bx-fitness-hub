/**
 * The navigation hooks, for rendering a component without a router.
 *
 * usePathname is the one that matters: Logo and NotFound both change what
 * they render depending on where they are, and those differences are the
 * point of several tests.
 */
let pathname = "/";

export function setPathname(next: string) {
  pathname = next;
}

export function usePathname() {
  return pathname;
}

/**
 * Counted, because "the screen goes and re-reads the list" is the only way
 * a staff screen shows the row it just changed. A handler that quietly
 * stops calling it leaves the desk looking at a stale list.
 */
export let refreshes = 0;

export function resetRouter() {
  refreshes = 0;
}

export function useRouter() {
  return {
    push() {},
    replace() {},
    refresh() {
      refreshes += 1;
    },
    back() {},
    forward() {},
    prefetch() {},
  };
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function notFound(): never {
  throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_NOT_FOUND" });
}

export function redirect(url: string): never {
  const error = Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
    digest: `NEXT_REDIRECT;replace;${url}`,
  });
  throw error;
}
