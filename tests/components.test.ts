import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { setPathname } from "./support/stubs/next-navigation.ts";

/*
  What the components put on the page, rendered without a browser.

  react-dom/server runs the first render and no effects, which is exactly
  the right scope for these: the bug they were written for was in the markup
  itself - every link in the chrome was a bare "#classes", which means
  nothing anywhere but the home page. Behaviour that only exists after an
  effect (the timetable filling in, the dialog trapping focus) is not
  reachable this way and is covered by the unit tests underneath it.
*/

const render = (component: unknown, props: Record<string, unknown> = {}) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderToStaticMarkup(createElement(component as any, props));

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

describe("the chrome that renders on every page", () => {
  beforeEach(() => setPathname("/"));

  for (const [label, path] of [
    ["Navbar", "../src/components/Navbar.tsx"],
    ["Footer", "../src/components/Footer.tsx"],
    ["MobileBar", "../src/components/MobileBar.tsx"],
  ] as const) {
    it(`${label} links to the home page's sections, never to "this page"`, async () => {
      const Component = (await import(path)).default;
      const found = hrefs(render(Component));
      const fragments = found.filter((h) => h.startsWith("#"));
      assert.deepEqual(
        fragments,
        [],
        `${label} renders on the booking page too, where ${fragments.join(", ")} means nothing`,
      );
      assert.ok(found.some((h) => h.startsWith("/#")), `${label} should link to at least one section`);
    });

    it(`${label} renders the same links from a booking page`, async () => {
      setPathname("/b/fba1986552ec4e7c90279ca0d5469b81");
      const Component = (await import(path)).default;
      assert.deepEqual(hrefs(render(Component)).filter((h) => h.startsWith("#")), []);
    });
  }

  it("Navbar offers a way to call and a way to join", async () => {
    const Navbar = (await import("../src/components/Navbar.tsx")).default;
    const html = render(Navbar);
    assert.ok(hrefs(html).some((h) => h.startsWith("tel:")), "the phone number is the point of a gym site");
    assert.ok(hrefs(html).includes("/#membership"));
  });

  it("MobileBar keeps its three taps: call, book, join", async () => {
    const MobileBar = (await import("../src/components/MobileBar.tsx")).default;
    const found = hrefs(render(MobileBar));
    assert.equal(found.length, 3);
    assert.ok(found[0].startsWith("tel:"));
    assert.deepEqual(found.slice(1), ["/#classes", "/#membership"]);
  });
});

describe("the logo", () => {
  it("is a link home wherever it is", async () => {
    const { Logo } = await import("../src/components/ui/Logo.tsx");
    setPathname("/b/abc");
    assert.ok(hrefs(render(Logo)).includes("/"));
  });

  it("says it goes to the top on the home page, and home everywhere else", async () => {
    // It scrolls to the top when it is already home, and is a real journey
    // otherwise. The label has to match what the click does.
    const { Logo } = await import("../src/components/ui/Logo.tsx");

    setPathname("/");
    assert.match(render(Logo), /aria-label="BX Fitness Hub - back to top"/);

    setPathname("/b/abc");
    assert.match(render(Logo), /aria-label="BX Fitness Hub - home"/);
  });
});

describe("the page that says something is missing", () => {
  it("talks about a booking when the address was a booking link", async () => {
    // /b/<token> 404s when a link is mistyped, cut short by whatever app it
    // was pasted through, or points at a booking staff have removed. "Page
    // not found" is no use to the member holding it.
    setPathname("/b/0000000000000000000000000000000f");
    const NotFound = (await import("../src/components/NotFound.tsx")).default;
    const html = render(NotFound);

    assert.match(html, /Booking not found/i);
    assert.match(html, /call us/i);
    assert.ok(hrefs(html).some((h) => h.startsWith("tel:")), "give them the phone, not a dead end");
    assert.ok(hrefs(html).includes("/#classes"));
  });

  it("points a lost staff member at their dashboard", async () => {
    setPathname("/staff/bookings");
    const NotFound = (await import("../src/components/NotFound.tsx")).default;
    const html = render(NotFound);

    assert.match(html, /No such screen/i);
    assert.ok(hrefs(html).includes("/staff"));
    assert.ok(!/See the timetable/i.test(html), "not the answer to a staff question");
  });

  it("points anyone else back into the site", async () => {
    setPathname("/somewhere-that-does-not-exist");
    const NotFound = (await import("../src/components/NotFound.tsx")).default;
    const html = render(NotFound);

    assert.match(html, /Page not found/i);
    assert.ok(hrefs(html).includes("/"));
    assert.ok(hrefs(html).includes("/#classes"));
  });
});

describe("the booking dialog", () => {
  const target = {
    id: "0-200-mobility-flexibility",
    date: "2026-09-26",
    session: { time: "2:00 PM", coach: "Nourhan Kamal", discipline: "Mobility & Flexibility" },
    spotsLeft: 10,
    mode: "book" as const,
  };

  const open = async (over: Record<string, unknown> = {}) => {
    const BookingDialog = (await import("../src/components/BookingDialog.tsx")).default;
    return render(BookingDialog, { target: { ...target, ...over }, onClose() {}, onBooked() {} });
  };

  it("announces itself to a screen reader as a modal with a name", async () => {
    const html = await open();
    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    assert.ok(labelledBy, "a dialog needs a name");
    assert.ok(html.includes(`id="${labelledBy}"`), "and the thing it names has to be on the page");
  });

  it("says which class, with whom and when", async () => {
    const html = await open();
    assert.match(html, /Mobility &amp; Flexibility/);
    assert.match(html, /Nourhan Kamal/);
    assert.match(html, /2:00 PM/);
  });

  it("opens by asking whether you are a member", async () => {
    // It decides what is asked next and what happens at the desk, so it is
    // the first thing rather than a checkbox further down. The fields
    // themselves are covered where they can be typed into.
    const html = await open();
    assert.match(html, /Are you a BX member\?/i);
    assert.match(html, /Yes, I.{1,8}m a member/);
    assert.match(html, /No, I.{1,8}m a guest/);
    assert.equal([...html.matchAll(/<input/g)].length, 0, "nothing is asked yet");
    // And it says why the answer matters, in the member's terms.
    assert.match(html, /part of their membership/i);
  });

  it("offers a place when there is one and a queue when there is not", async () => {
    assert.match(await open({ mode: "book", spotsLeft: 10 }), /Confirm Place/i);
    const full = await open({ mode: "waitlist", spotsLeft: 0 });
    assert.match(full, /waitlist|list/i);
    assert.ok(!/Confirm Place/i.test(full), "a full class is not offering a place");
  });

  it("has a way out that is not the browser's back button", async () => {
    assert.match(await open(), /Close/i);
  });
});

describe("Button", () => {
  it("keeps a same-page anchor a plain anchor", async () => {
    // next/link does not reliably scroll to a hash on the route it is
    // already on, which is every section link on the home page.
    const { Button } = await import("../src/components/ui/Button.tsx");
    const html = render(Button, { href: "#contact", children: "Book a Free Trial" });
    assert.match(html, /^<a href="#contact"/);
    assert.ok(!/target=/.test(html));
  });

  it("opens an outside link in its own tab, safely", async () => {
    const { Button } = await import("../src/components/ui/Button.tsx");
    const html = render(Button, { href: "https://instagram.com/bx_fitnesshub", children: "Instagram" });
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
  });

  it("does not put a tel: link in a new tab", async () => {
    const { Button } = await import("../src/components/ui/Button.tsx");
    const html = render(Button, { href: "tel:+201040001413", children: "Call" });
    assert.match(html, /href="tel:\+201040001413"/);
    assert.ok(!/target=/.test(html));
  });
});
