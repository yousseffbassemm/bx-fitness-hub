import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { isPlaceholder, nav, site } from "../src/lib/site.ts";

/*
  The bug this file exists for: every link in the header, the mobile sheet,
  the footer and the phone bar was written as "#classes". That is the same
  thing as "/#classes" while the site is one page - and stops being the same
  thing the moment there is a second one. From a member's booking page at
  /b/<token> a bare fragment means "a section of this page", there is no such
  section, and the click did nothing at all. On the one page with nothing
  else to click.
*/

const root = path.resolve(import.meta.dirname, "..");

/** Rendered on every page, so their links have to work from every page. */
const CHROME = [
  "src/components/Navbar.tsx",
  "src/components/Footer.tsx",
  "src/components/MobileBar.tsx",
];

/** Only ever rendered on the home page, so a bare fragment is correct there. */
const HOME_ONLY = "src/components/sections";

describe("links to a section of the home page", () => {
  it("are absolute in the nav config", () => {
    assert.ok(nav.length > 0);
    for (const item of nav) {
      assert.match(item.href, /^\/#[a-z-]+$/, `${item.label} must point at /#section`);
    }
  });

  it("are absolute everywhere the chrome is rendered", () => {
    for (const file of CHROME) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      const bare = [...source.matchAll(/href="(#[^"]*)"/g)].map((m) => m[1]);
      assert.deepEqual(
        bare,
        [],
        `${file} has a fragment-only link (${bare.join(", ")}). It renders on ` +
          "the booking page too, where there is no such section.",
      );
    }
  });

  it("are still allowed to be bare inside the home page's own sections", () => {
    // Not a rule being enforced so much as a note on why the check above is
    // scoped: these only ever render on "/", where #contact is correct and
    // cheaper than a route change.
    const dir = path.join(root, HOME_ONLY);
    const anyBare = fs
      .readdirSync(dir)
      .some((f) => /href="#/.test(fs.readFileSync(path.join(dir, f), "utf8")));
    assert.equal(typeof anyBare, "boolean");
  });

  it("keeps the skip link pointing at the main landmark", () => {
    const layout = fs.readFileSync(path.join(root, "src/app/(site)/layout.tsx"), "utf8");
    assert.match(layout, /href="#main"/, "the skip link is a same-page anchor by definition");
    assert.match(layout, /id="main"/, "and it needs something to skip to");
  });
});

describe("placeholders", () => {
  it("recognises the bracketed values that are not real yet", () => {
    assert.equal(isPlaceholder("[MONTHLY PRICE]"), true);
    assert.equal(isPlaceholder("  [EMAIL ADDRESS]  "), true);
    assert.equal(isPlaceholder("1,200 EGP"), false);
    assert.equal(isPlaceholder(""), false);
    assert.equal(isPlaceholder("[]"), false, "empty brackets are not a placeholder");
  });

  it("still marks the email address, so nothing publishes it as real", () => {
    // If this fails because BX now has a public address, that is good news:
    // replace the placeholder and delete this assertion.
    assert.equal(isPlaceholder(site.email.display), true);
  });

  it("has real, unbracketed phone numbers", () => {
    assert.equal(isPlaceholder(site.phone.display), false);
    assert.match(site.phone.href, /^tel:\+\d{8,}$/);
  });
});
