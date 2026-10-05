import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAssistantInputGrants } from "./runtime-grants.mjs";
test("runtime cannot seed policy, alter approved account/caps, delete journal or gain closure mutation functions", async () => {
  const sql = [];
  await applyAssistantInputGrants(
    { query: async (text) => sql.push(text) },
    "treido_runtime",
  );
  assert.ok(
    sql.every(
      (text) =>
        !text.includes("DELETE") &&
        !text.includes("TRUNCATE") &&
        !text.includes(" TO PUBLIC") &&
        !text.includes("EXECUTE"),
    ),
  );
  assert.match(sql[0], /^REVOKE ALL ON/);
  assert.equal((sql[0].match(/treido\./g) ?? []).length, 9);
  const registry = sql.filter(
    (text) =>
      text.startsWith("GRANT") && text.includes("assistant_runtime_policies"),
  );
  assert.equal(registry.length, 1);
  assert.match(registry[0], /^GRANT SELECT,UPDATE\(id\)/);
  assert.ok(!registry[0].includes("INSERT"));
  assert.ok(
    sql
      .filter((text) => text.startsWith("GRANT UPDATE"))
      .every((text) => /^GRANT UPDATE\([a-z_,]+\) ON/.test(text)),
  );
});
test("existing broad table and column grants are removed before exact data grants", async () => {
  const privilege = new Map(
    [
      "assistant_runtime_policies",
      "buyer_assistant_receipts",
      "assistant_usage_evidence",
    ].map((table) => [
      table,
      new Set(["SELECT", "INSERT", "UPDATE", "UPDATE(config)", "DELETE"]),
    ]),
  );
  await applyAssistantInputGrants(
    {
      query: async (sql) => {
        if (sql.startsWith("REVOKE ALL"))
          for (const value of privilege.values()) value.clear();
        else if (sql.startsWith("GRANT SELECT,UPDATE(id)"))
          privilege
            .get("assistant_runtime_policies")
            .add("SELECT")
            .add("UPDATE(id)");
        else if (sql.startsWith("GRANT SELECT,INSERT"))
          for (const table of [
            "buyer_assistant_receipts",
            "assistant_usage_evidence",
          ])
            privilege.get(table).add("SELECT").add("INSERT");
      },
    },
    "treido_runtime",
  );
  assert.deepEqual(
    [...privilege.get("assistant_runtime_policies")],
    ["SELECT", "UPDATE(id)"],
  );
  for (const table of ["buyer_assistant_receipts", "assistant_usage_evidence"])
    assert.deepEqual([...privilege.get(table)], ["SELECT", "INSERT"]);
});
test("untrusted role is rejected before any SQL", async () => {
  let calls = 0;
  for (const role of [
    "postgres",
    "public",
    'runtime";DROP TABLE treido.users',
    "",
    null,
  ])
    await assert.rejects(() =>
      applyAssistantInputGrants({ query: async () => calls++ }, role),
    );
  assert.equal(calls, 0);
});
