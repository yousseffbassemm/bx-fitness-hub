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

/*
  The schema audit query (queries/06) lists, by name, every object it expects
  the live database to have. That list is a second copy of what the schema
  declares, and a second copy goes stale: add a table to the schema, forget
  the audit, and it carries on reporting "26 of 26 present" while never
  looking at the new one. A check that cannot fail is worse than none.
*/
describe("the schema audit query", () => {
  const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

  /** Everything supabase/schema/*.sql creates, by kind and name. */
  function declaredBySchema() {
    const sql = partFiles()
      .map((f) => read(path.join("supabase", "schema", f)))
      .join("\n");
    const grab = (re: RegExp) => [...sql.matchAll(re)].map((m) => m[m.length - 1]);
    return new Set([
      ...grab(/create table(?: if not exists)?\s+(?:public\.)?(\w+)/gi).map((n) => `table:${n}`),
      ...grab(/create (?:unique )?index(?: if not exists)?\s+(\w+)/gi).map((n) => `index:${n}`),
      ...grab(/create or replace function\s+(?:public\.)?(\w+)/gi).map((n) => `function:${n}`),
      ...grab(/add constraint\s+(\w+)/gi).map((n) => `constraint:${n}`),
    ]);
  }

  /** Everything the audit query says it will look for. */
  function listedByAudit() {
    const audit = read(path.join("supabase", "queries", "06-schema-audit.sql"));
    return new Set(
      [...audit.matchAll(/\('(table|index|function|constraint)','(\w+)'\)/g)].map(
        (m) => `${m[1]}:${m[2]}`,
      ),
    );
  }

  it("looks for exactly what the schema creates", () => {
    const declared = declaredBySchema();
    const listed = listedByAudit();

    const unchecked = [...declared].filter((x) => !listed.has(x));
    assert.deepEqual(
      unchecked,
      [],
      `the schema creates these and the audit never checks them: ${unchecked.join(", ")}`,
    );

    const phantom = [...listed].filter((x) => !declared.has(x));
    assert.deepEqual(
      phantom,
      [],
      `the audit checks for these and the schema does not create them: ${phantom.join(", ")}`,
    );
  });

  it("reads only, so it is safe against production", () => {
    for (const file of fs.readdirSync(path.join(root, "supabase", "queries"))) {
      const body = read(path.join("supabase", "queries", file))
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n");
      assert.doesNotMatch(
        body,
        /\b(insert|update|delete|drop|alter|truncate|grant|revoke)\s+(into|from|table|function|index|on)\b/i,
        `${file} contains something that writes`,
      );
    }
  });
});
