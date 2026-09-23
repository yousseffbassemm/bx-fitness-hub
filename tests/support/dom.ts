/**
 * A browser, near enough, inside Node.
 *
 * jsdom builds the live page that the string-rendering tests do not have:
 * real elements, real focus, real events. That is what lets a test press
 * Tab and find out whether the dialog keeps it inside.
 *
 * Import this before anything that touches the DOM - react-dom, testing
 * library, or a component - because they read these globals as they load.
 *
 * The polyfills at the bottom are the browser APIs this site uses that
 * jsdom does not implement. Each is the smallest thing that keeps the
 * component honest: matchMedia answers "no preference", so reduced-motion
 * paths are not silently taken; IntersectionObserver reveals immediately,
 * so scroll-reveal content is present rather than waiting for a scroll that
 * will never happen in a test.
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://bx.test/",
  pretendToBeVisual: true,
});

const win = dom.window as unknown as Window & typeof globalThis;
const g = globalThis as unknown as Record<string, unknown>;

/** Node defines some of these itself, read-only, so assignment will not do. */
function define(key: string, value: unknown) {
  try {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  } catch {
    // a handful cannot be redefined at all; the page does not need them
  }
}

define("window", win);
define("document", win.document);
define("navigator", win.navigator);

/*
  Node reserves the storage names itself, so the "do not clobber Node's
  globals" loop below skips them and the page is left with nothing to
  remember a booking in. These are the browser's, deliberately.
*/
define("localStorage", win.localStorage);
define("sessionStorage", win.sessionStorage);

// Everything else the page expects on the global object, without clobbering
// what Node already provides (fetch, URL, and friends are Node's).
for (const key of Object.getOwnPropertyNames(win)) {
  if (key in g) continue;
  try {
    define(key, (win as unknown as Record<string, unknown>)[key]);
  } catch {
    // some are getters that throw outside a real browser; skip them
  }
}

/** React needs telling that it is being driven by a test, not a user. */
define("IS_REACT_ACT_ENVIRONMENT", true);

if (!win.matchMedia) {
  win.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as typeof win.matchMedia;
  define("matchMedia", win.matchMedia);
}

if (!("IntersectionObserver" in win)) {
  class Immediate {
    #callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.#callback = callback;
    }
    observe(target: Element) {
      // Reveal-on-scroll content is present from the start; a test never
      // scrolls, and content that never appears is not worth asserting on.
      this.#callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  define("IntersectionObserver", Immediate);
  (win as unknown as Record<string, unknown>).IntersectionObserver = Immediate;
}

// jsdom has no layout, so scrolling is a no-op rather than an error.
win.scrollTo = (() => {}) as typeof win.scrollTo;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

/*
  A failed query prints the DOM around it. This section is large, and
  formatting all of it turned a one second failure into minutes of work
  before the message appeared.
*/
process.env.DEBUG_PRINT_LIMIT ??= "3000";

export { dom };
