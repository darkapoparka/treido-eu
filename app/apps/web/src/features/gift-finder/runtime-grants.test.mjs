import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGiftFinderGrants } from "./runtime-grants.mjs";
test("only three feature relations and disposable observations receive narrow rights", async () => {
  const sql = [];
  await applyGiftFinderGrants(
    { query: async (text) => sql.push(text) },
    "treido_runtime",
  );
  assert.equal(sql.length, 8);
  assert.equal(sql.filter((text) => text.startsWith("REVOKE ALL")).length, 3);
  assert.equal(
    sql.filter((text) => text.startsWith("GRANT SELECT,INSERT")).length,
    3,
  );
  assert.equal(sql.filter((text) => text.startsWith("GRANT DELETE")).length, 1);
  assert.match(sql.at(-1), /DELETE ON treido.buyer_gift_observations/);
  assert.ok(
    sql.every(
      (text) => !text.includes("TRUNCATE") && !text.includes("treido.users"),
    ),
  );
  assert.ok(
    sql
      .filter((text) => text.startsWith("GRANT"))
      .every((text) => !text.includes("PUBLIC")),
  );
  assert.ok(
    sql
      .filter((text) => text.startsWith("GRANT UPDATE"))
      .every((text) => text.includes("buyer_gift_workspaces")),
  );
});
test("role injection rejected before any statement", async () => {
  let calls = 0;
  await assert.rejects(() =>
    applyGiftFinderGrants(
      { query: async () => calls++ },
      'runtime"; DROP TABLE treido.users',
    ),
  );
  assert.equal(calls, 0);
});
