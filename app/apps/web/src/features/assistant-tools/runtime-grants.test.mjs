import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAssistantToolsGrants } from "./runtime-grants.mjs";
test("runtime permissions are restricted to the seven helper tables", async () => {
  const statements = [];
  await applyAssistantToolsGrants(
    {
      query: async (text) => {
        statements.push(text);
      },
    },
    "treido_runtime",
  );
  const sql = statements.join("\n");
  assert.match(sql, /FROM PUBLIC/);
  assert.match(sql, /UPDATE\(revision,requirements,updated_at\)/);
  assert.doesNotMatch(
    sql,
    /GRANT\s+ALL|GRANT\s+UPDATE\s+ON|TRUNCATE|SCHEMA|draft_save_receipts|listing_drafts|seller_memberships/i,
  );
  for (const name of ["buyer_compatibility_receipts", "seller_helper_receipts"])
    assert.doesNotMatch(
      sql,
      new RegExp(`GRANT (?:UPDATE|DELETE)[^;]*${name}`, "i"),
    );
});
test("runtime role cannot inject another grant", async () => {
  let calls = 0;
  await assert.rejects(() =>
    applyAssistantToolsGrants(
      {
        query: async () => {
          calls++;
        },
      },
      'x";GRANT ALL ON SCHEMA treido TO PUBLIC;--',
    ),
  );
  assert.equal(calls, 0);
});
