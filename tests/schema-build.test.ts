import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/*
  supabase/schema.sql is assembled from supabase/schema/*.sql.

  Two copies of the same thing drift, and this pair drifts silently: the
  parts are what gets read and edited, schema.sql is what gets pasted into
  the SQL editor. Editing a part and pasting a stale file would set the live
  database back to whatever it said last time, which is the one mistake here
  nobody would notice until a booking failed.
*/

const root = path.join(import.meta.dirname, "..");
const { buildSchema, partFiles } = await import("../scripts/build-schema.mjs");

describe("the assembled database schema", () => {
  it("matches the parts it is built from", () => {
    const current = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
    assert.equal(
      current,
      buildSchema(),
      "supabase/schema.sql is stale - run `npm run schema` and commit it",
    );
  });

  it("runs the parts in an order the database will accept", () => {
    const files = partFiles();
    const at = (needle: string) => files.findIndex((f) => f.includes(needle));

    // members must exist before bookings can reference it, and both before
    // the functions that read and write them.
    assert.ok(at("members") < at("bookings-membership"), "members comes before the link to it");
    assert.ok(at("bookings-membership") < at("booking-functions"), "columns before the functions using them");
    assert.ok(at("extensions") === 0, "extensions first");
    assert.deepEqual([...files].sort(), files, "filenames carry the order, so they must be sorted");
  });

  it("keeps every part inside the assembled file", () => {
    const built = buildSchema();
    for (const file of partFiles()) {
      const body = fs
        .readFileSync(path.join(root, "supabase", "schema", file), "utf8")
        .trimEnd();
      assert.ok(built.includes(body), `${file} is missing from the assembled schema`);
    }
  });
});
