import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

/*
  A coach, a facility and a gallery tile can each borrow the photograph that
  ships in the code. What tied a saved row to its photograph used to be the
  row's own visible text - a coach's name, a facility's title, a photo's
  description - which is the exact text the editing screens invite you to
  change. So renaming anything broke the link, and the save was refused with
  a message about a new item needing a photo. Nobody had added anything.

  Rows carry where they started now. These tests hold that in place: the
  wording is free to change, the photograph follows the row, and rows saved
  before any of this existed still resolve.
*/

const tmp = path.join(os.tmpdir(), `bx-content-test-${process.pid}.db`);
process.env.BOOKINGS_DB_PATH = tmp;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { supabaseConfigured } = await import("../src/lib/store/supabase.ts");
assert.equal(
  supabaseConfigured,
  false,
  "these tests write content, and must never be pointed at the real database",
);

const { getStore } = await import("../src/lib/store/index.ts");
const {
  defaultCoachValues,
  defaultFacilityValues,
  defaultGalleryValues,
  getCoaches,
  getEditableCoaches,
  getEditableFacilities,
  getEditableGallery,
  getFacilities,
  getGallery,
  uploadUrl,
} = await import("../src/lib/content.ts");

const store = await getStore();
const write = (key: string, value: unknown) => store.setContent(key, value, "tests");
const clear = async () => {
  for (const key of ["gallery", "facilities", "coaches"]) await write(key, []);
};

/**
 * The file a photo points at, e.g. "feed-stretch.jpg".
 *
 * A photo is either an uploaded URL or the imported image, which Next turns
 * into a StaticImageData object - so this has to read both, or every
 * comparison quietly becomes "[object Object]" against itself and passes
 * whatever the images are.
 */
const file = (photo: unknown) => {
  const src = typeof photo === "string" ? photo : (photo as { src?: string })?.src;
  assert.equal(typeof src, "string", `expected a photo, got ${JSON.stringify(photo)}`);
  return String(src).split("/").pop();
};

after(() => {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(tmp + suffix, { force: true });
});

describe("the gallery", () => {
  beforeEach(clear);

  it("is the code's own mosaic when nothing has been saved", async () => {
    const shown = await getGallery();
    const code = defaultGalleryValues();
    assert.equal(shown.length, code.length);
    assert.deepEqual(
      shown.map((g) => g.alt),
      code.map((g) => g.alt),
    );
  });

  it("keeps a tile's photograph when its description is rewritten", async () => {
    /*
      The bug, in one test - and it has to move the tile as well as rename
      it. Matching on the description has a last-resort fallback to the row's
      position, so a rename in place still lands on the right photograph by
      luck. Renaming a tile that has also been moved is the case that tells
      the two apart, and it is what staff actually do.
    */
    const rows = defaultGalleryValues();
    const moved = rows[7];
    const itsPhoto = file((await getGallery())[7].src);
    assert.equal(itsPhoto, "feed-stretch.jpg");

    await write("gallery", [
      { ...moved, alt: "A completely different description" },
      ...rows.slice(0, 7),
    ]);

    const after = await getGallery();
    assert.equal(after[0].alt, "A completely different description");
    assert.equal(file(after[0].src), itsPhoto, "the photograph must not move with the words");
  });

  it("keeps every tile with its own photograph when the mosaic is reordered", async () => {
    // Matched by position, reordering handed each tile its neighbour's image.
    const rows = defaultGalleryValues();
    const reversed = [...rows].reverse();
    await write("gallery", reversed);

    const shown = await getGallery();
    const straight = await (async () => {
      await write("gallery", rows);
      return getGallery();
    })();

    const wanted = new Map(straight.map((g) => [g.alt, file(g.src)]));
    for (const tile of shown) {
      assert.equal(file(tile.src), wanted.get(tile.alt), `${tile.alt} kept the wrong photo`);
    }
  });

  it("still resolves rows saved before any of this existed", async () => {
    // Those rows have no `base`. They are matched on their text, which is
    // safe precisely because the old rule made it impossible to save a row
    // whose text had drifted from the code.
    const legacy = defaultGalleryValues().map(({ base, ...rest }) => rest);
    assert.ok(!("base" in legacy[0]));
    await write("gallery", legacy);

    const shown = await getGallery();
    assert.equal(file(shown[0].src), "cardio-rings.jpg");
    assert.equal(file(shown[7].src), "feed-stretch.jpg");
  });

  it("stamps the identity onto legacy rows when the editor opens them", async () => {
    const legacy = defaultGalleryValues().map(({ base, ...rest }) => rest);
    await write("gallery", legacy);

    const editable = await getEditableGallery();
    assert.ok(
      editable.every((g) => typeof g.base === "string" && g.base.length > 0),
      "so the next save keeps it and the description becomes free to change",
    );
  });

  it("hands the editor rows in the same shape it will send back", async () => {
    // The screens decide whether there is anything to save by comparing their
    // draft to this as JSON, which is order-sensitive: a mismatch made every
    // screen open claiming unsaved changes.
    await write("gallery", defaultGalleryValues());
    const [fromStore] = await getEditableGallery();
    assert.deepEqual(Object.keys(fromStore), Object.keys(defaultGalleryValues()[0]));
  });

  it("prefers an uploaded photo over the one in the code", async () => {
    const rows = defaultGalleryValues();
    const id = "a".repeat(32);
    await write("gallery", [{ ...rows[0], photoId: id }, ...rows.slice(1)]);
    assert.equal((await getGallery())[0].src, uploadUrl(id));
  });
});

describe("facilities", () => {
  beforeEach(clear);

  it("keeps a card's photograph when it is retitled", async () => {
    // Retitled and moved, for the reason the gallery test gives: matching on
    // the title falls back to position, which hides a rename done in place.
    const rows = defaultFacilityValues();
    const itsPhoto = file((await getFacilities())[0].photo);

    await write("facilities", [...rows.slice(1), { ...rows[0], title: "The Weights Room" }]);

    const shown = await getFacilities();
    const moved = shown.at(-1)!;
    assert.equal(moved.title, "The Weights Room");
    assert.equal(file(moved.photo), itsPhoto);
  });

  it("keeps each card's photograph when they are reordered", async () => {
    const rows = defaultFacilityValues();
    await write("facilities", [rows[1], rows[0], ...rows.slice(2)]);
    const shown = await getFacilities();
    assert.equal(shown[0].title, rows[1].title);
    assert.equal(file(shown[0].photo), file((await (async () => {
      await write("facilities", rows);
      return getFacilities();
    })())[1].photo));
  });

  it("stamps the identity onto legacy rows", async () => {
    await write("facilities", defaultFacilityValues().map(({ base, ...rest }) => rest));
    assert.ok((await getEditableFacilities()).every((f) => typeof f.base === "string"));
  });
});

describe("coaches", () => {
  beforeEach(clear);

  it("keeps a coach's portrait when their name is corrected", async () => {
    // The one a gym will actually hit: a misspelled name on the site.
    const rows = defaultCoachValues();
    const before = (await getCoaches())[0].photo;

    await write("coaches", [{ ...rows[0], name: "Ahmed Ayman Hassan" }, ...rows.slice(1)]);

    const shown = await getCoaches();
    assert.equal(shown[0].name, "Ahmed Ayman Hassan");
    assert.equal(shown[0].photo, before, "the portrait belongs to the person, not to the spelling");
  });

  it("keeps the crop that was chosen for them", async () => {
    const rows = defaultCoachValues();
    await write("coaches", [{ ...rows[0], focus: "center 40%" }, ...rows.slice(1)]);
    assert.equal((await getCoaches())[0].focus, "center 40%");
  });

  it("stamps the identity onto legacy rows", async () => {
    await write("coaches", defaultCoachValues().map(({ base, ...rest }) => rest));
    assert.ok((await getEditableCoaches()).every((c) => typeof c.base === "string"));
  });

  it("falls back to an empty photo rather than throwing for somebody new", async () => {
    await write("coaches", [
      { base: null, name: "Brand New", credential: "CPT", disciplines: [], photoId: null, focus: "center top" },
    ]);
    const shown = await getCoaches();
    assert.equal(shown.length, 1);
    assert.equal(shown[0].photo, "");
  });
});
