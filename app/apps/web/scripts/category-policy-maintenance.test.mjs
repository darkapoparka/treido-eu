import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { sourcePolicies } from "./category-activation-dry-run.mjs";
import {
  parseReviewedPacket,
  parseMaintenancePlan,
  maintenanceHash,
  createMaintenancePlan,
  applyMaintenancePlan,
} from "./category-policy-maintenance-core.mjs";
import {
  maintenanceArguments,
  qualifiedMaintenanceConnection,
  runMaintenance,
} from "./category-policy-maintenance.mjs";

// Hypothetical inputs for boundary tests. These are not an actual review or a
// target authorization, and none of these tests opens a database/provider socket.
const packet = () => ({
  format: "treido-category-review-v1",
  target: {
    application: "treido-eu",
    environment: "test",
    projectId: "test-project",
    branchId: "br-isolated-test",
    database: "treido_test",
    region: "eu-central-1",
    runtimeRole: "treido_runtime",
    maintenanceRole: "treido_maintenance",
    country: "BG",
  },
  authorizationReference: "test-only-operator-authorization",
  decision: {
    reference: "test-only-review-decision",
    reviewedBy: "isolated-test-maintainer",
    reviewedAt: "2026-01-01T00:00:00.000Z",
    goodsScope: "ordinary-physical-nonregulated",
  },
  policies: [
    {
      categoryId: "cat:books-media/fiction",
      sellerKinds: ["personal"],
      conditions: ["good"],
      handoverModes: ["pickup"],
      purchaseModes: ["contact"],
    },
  ],
});
const reviewed = (input = packet()) => {
  const bytes = Buffer.from(JSON.stringify(input));
  return parseReviewedPacket(bytes, maintenanceHash(bytes));
};
const bindings = () => ({
  TREIDO_ENV: "test",
  TREIDO_DATA_MODE: "database",
  TREIDO_NEON_PROJECT_ID: "test-project",
  TREIDO_NEON_BRANCH_ID: "br-isolated-test",
  TREIDO_NEON_BRANCH_PURPOSE: "test",
  TREIDO_DB_REGION: "eu-central-1",
  TREIDO_DB_DATABASE: "treido_test",
  TREIDO_DB_ROLE: "treido_runtime",
  DATABASE_URL:
    "postgresql://treido_runtime:test-only@ep-isolated.eu-central-1.aws.neon.tech/treido_test?sslmode=require",
  MIGRATION_DATABASE_URL:
    "postgresql://treido_maintenance:test-only@ep-isolated.eu-central-1.aws.neon.tech/treido_test?sslmode=verify-full",
});
function fakeClient() {
  const seed = sourcePolicies().rows.find(
    (p) => p.categoryId === "cat:books-media/fiction",
  );
  const state = {
    calls: [],
    policy: {
      registry_version: 1,
      category_id: seed.categoryId,
      category_kind: "leaf",
      country: "BG",
      version: 1,
      state: "pending",
      enabled_for_publish: false,
      rules: {
        ...seed.rules,
        restrictions: [
          ...seed.rules.restrictions,
          "retain_current_restriction",
        ],
        additionalCurrentRule: true,
      },
      review_reference: null,
      reviewed_at: null,
    },
    registry: {
      version: 1,
      content_hash:
        "c55a24a0fa4a7a6e625f1945d1135c028a507bae1c22113bfb6234e2d8b4b142",
      created_at: "2026-01-01T00:00:00Z",
    },
    category: {
      registry_version: 1,
      id: seed.categoryId,
      kind: "leaf",
      profile: { required: true },
    },
    authority: {
      database: "treido_test",
      role: "treido_maintenance",
      login: "treido_maintenance",
      can_insert: true,
      runtime_restricted: true,
      runtime_write: false,
      runtime_admin: false,
    },
    recorded: false,
    insertFailure: false,
  };
  return {
    state,
    async query(sql, params) {
      state.calls.push(sql);
      if (sql.startsWith("SELECT current_database"))
        return { rows: [state.authority] };
      if (sql.includes("FROM treido.category_registry_versions"))
        return { rows: [{ value: state.registry }] };
      if (sql.includes("FROM treido.categories c"))
        return { rows: [{ value: state.category }] };
      if (sql.startsWith("SELECT to_jsonb(p)"))
        return { rows: [{ value: state.policy }] };
      if (sql.startsWith("SELECT 1 FROM treido.category_policies"))
        return { rowCount: state.recorded ? 1 : 0, rows: [] };
      if (sql.startsWith("INSERT")) {
        if (state.insertFailure) throw new Error("database insert failed");
        state.policy = {
          registry_version: params[0],
          category_id: params[1],
          category_kind: params[2],
          country: params[3],
          version: params[4],
          state: "reviewed",
          enabled_for_publish: true,
          rules: JSON.parse(params[5]),
          review_reference: params[6],
          reviewed_at: "2026-01-02T00:00:00Z",
        };
        return { rows: [{ value: state.policy }] };
      }
      return { rows: [] };
    },
  };
}
test("requires exact raw packet/plan SHA256 and bounded input", () => {
  const bytes = Buffer.from(JSON.stringify(packet()));
  assert.equal(
    parseReviewedPacket(bytes, maintenanceHash(bytes)).packet.policies[0]
      .categoryId,
    "cat:books-media/fiction",
  );
  assert.throws(
    () => parseReviewedPacket(bytes, "a".repeat(64)),
    /INPUT_HASH_MISMATCH/,
  );
  assert.throws(
    () => parseReviewedPacket(Buffer.alloc(65537), "a".repeat(64)),
    /INPUT_HASH_MISMATCH/,
  );
  assert.throws(
    () => parseMaintenancePlan(bytes, "b".repeat(64)),
    /INPUT_HASH_MISMATCH/,
  );
  const invalid = Buffer.from("not-json");
  assert.throws(
    () => parseReviewedPacket(invalid, maintenanceHash(invalid)),
    /INVALID_JSON/,
  );
});
test("requires actual nonplaceholder decision and explicit target authorization fields", () => {
  for (const change of [
    (p) => (p.decision.reference = null),
    (p) => (p.decision.reference = "unapproved-review"),
    (p) => (p.authorizationReference = "TODO authorization"),
    (p) => (p.decision.reviewedAt = "9999-01-01T00:00:00.000Z"),
    (p) => (p.decision.reviewedAt = "2026-02-30T00:00:00.000Z"),
    (p) => (p.decision.goodsScope = "regulated"),
    (p) => (p.target.maintenanceRole = p.target.runtimeRole),
    (p) => (p.extra = true),
  ]) {
    const input = packet();
    change(input);
    assert.throws(() => reviewed(input));
  }
});
test("rejects empty/oversized/duplicate/foreign leaves and modes or conditions outside Fiction pilot", () => {
  for (const change of [
    (p) => (p.policies = []),
    (p) => (p.policies = Array(13).fill(p.policies[0])),
    (p) => p.policies.push(p.policies[0]),
    (p) => (p.policies[0].categoryId = "cat:fashion/women"),
    (p) => (p.policies[0].handoverModes = ["shipping"]),
    (p) => (p.policies[0].purchaseModes = ["checkout"]),
    (p) => (p.policies[0].conditions = ["refurbished"]),
    (p) => (p.policies[0].sellerKinds = ["personal", "personal"]),
  ]) {
    const input = packet();
    change(input);
    assert.throws(() => reviewed(input));
  }
});
test("requires exact CLI mode, inputs, hashes and branch; help needs no bindings", async () => {
  assert.equal(
    maintenanceArguments([
      "--plan",
      "review.json",
      "--review-sha256",
      "a".repeat(64),
      "--branch",
      "br-isolated-test",
    ]).mode,
    "plan",
  );
  assert.equal(
    maintenanceArguments([
      "--apply",
      "plan.json",
      "--plan-sha256",
      "b".repeat(64),
      "--review",
      "review.json",
      "--review-sha256",
      "a".repeat(64),
      "--branch",
      "br-isolated-test",
    ]).mode,
    "apply",
  );
  for (const args of [
    [],
    ["--apply"],
    ["--help", "--apply"],
    ["--plan", "review.json"],
  ])
    assert.throws(() => maintenanceArguments(args));
  assert.match(await runMaintenance(["--help"], {}), /attestations/);
});
test("matches existing protected database declarations and separately authorized direct TLS login", () => {
  const target = packet().target;
  assert.equal(
    new URL(qualifiedMaintenanceConnection(bindings(), target, target.branchId))
      .username,
    target.maintenanceRole,
  );
  for (const change of [
    (e) => (e.TREIDO_NEON_PROJECT_ID = "other-project"),
    (e) => (e.TREIDO_ENV = "development"),
    (e) =>
      (e.MIGRATION_DATABASE_URL = e.MIGRATION_DATABASE_URL.replace(
        "ep-isolated.",
        "ep-foreign.",
      )),
    (e) =>
      (e.MIGRATION_DATABASE_URL = e.MIGRATION_DATABASE_URL.replace(
        "ep-isolated.",
        "ep-isolated-pooler.",
      )),
    (e) =>
      (e.MIGRATION_DATABASE_URL = e.MIGRATION_DATABASE_URL.replace(
        "treido_maintenance:",
        "treido_runtime:",
      )),
    (e) =>
      (e.MIGRATION_DATABASE_URL = e.MIGRATION_DATABASE_URL.replace(
        "verify-full",
        "disable",
      )),
    (e) => (e.MIGRATION_DATABASE_URL += "&options=-c%20role%3Dpostgres"),
    (e) => (e.MIGRATION_DATABASE_URL += "&sslmode=require"),
    (e) =>
      (e.MIGRATION_DATABASE_URL = e.MIGRATION_DATABASE_URL.replace(
        "test-only",
        "********",
      )),
  ]) {
    const env = bindings();
    change(env);
    assert.throws(() =>
      qualifiedMaintenanceConnection(env, target, target.branchId),
    );
  }
  assert.throws(() =>
    qualifiedMaintenanceConnection(bindings(), target, "br-other"),
  );
});
test("plan is read-only, preserves candidate restrictions, and binds exact registry/category/policy preimages", async () => {
  const client = fakeClient();
  const review = reviewed();
  const plan = await createMaintenancePlan(client, review);
  assert.equal(
    client.state.calls[0],
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  assert.equal(client.state.calls.at(-1), "COMMIT");
  assert.equal(
    client.state.calls.some((sql) => /^(INSERT|UPDATE|DELETE|LOCK)/.test(sql)),
    false,
  );
  assert.deepEqual(plan.preimages, [client.state.policy]);
  assert.deepEqual(plan.categories, [client.state.category]);
  assert.deepEqual(
    plan.proposals[0].rules.restrictions,
    client.state.policy.rules.restrictions,
  );
  assert.equal(plan.proposals[0].rules.additionalCurrentRule, true);
  assert.equal(plan.proposals[0].version, 2);
  assert.match(plan.proposals[0].review_reference, new RegExp(review.hash));
});
test("apply appends only once and identical latest replay performs no insert", async () => {
  const client = fakeClient();
  const review = reviewed();
  const original = JSON.parse(JSON.stringify(client.state.policy));
  const plan = await createMaintenancePlan(client, review);
  assert.equal(
    (await applyMaintenancePlan(client, plan, review)).status,
    "applied",
  );
  assert.equal(client.state.policy.version, 2);
  assert.equal(
    (await applyMaintenancePlan(client, plan, review)).status,
    "already-applied",
  );
  assert.equal(
    client.state.calls.filter((sql) => sql.startsWith("INSERT")).length,
    1,
  );
  assert.equal(original.state, "pending");
  assert.equal(
    client.state.calls.some((sql) => /^(UPDATE|DELETE)/.test(sql)),
    false,
  );
});
test("stale policy, registry or category aborts whole plan before inserts", async () => {
  for (const change of [
    (s) => s.policy.version++,
    (s) => s.policy.rules.restrictions.push("new_restriction"),
    (s) => (s.registry.content_hash = "a".repeat(64)),
    (s) => (s.registry.version = 2),
    (s) => (s.category.profile.required = false),
  ]) {
    const client = fakeClient();
    const review = reviewed();
    const plan = JSON.parse(
      JSON.stringify(await createMaintenancePlan(client, review)),
    );
    change(client.state);
    await assert.rejects(
      applyMaintenancePlan(client, plan, review),
      /PREIMAGE_MISMATCH/,
    );
    assert.equal(client.state.calls.at(-1), "ROLLBACK");
    assert.equal(
      client.state.calls.some((sql) => sql.startsWith("INSERT")),
      false,
    );
  }
});
test("tampered proposal or changed reviewed packet fails before transaction", async () => {
  const client = fakeClient();
  const review = reviewed();
  const plan = await createMaintenancePlan(client, review);
  plan.proposals[0].rules.restrictions = [];
  const before = client.state.calls.length;
  await assert.rejects(
    applyMaintenancePlan(client, plan, review),
    /PLAN_REVIEW_MISMATCH/,
  );
  assert.equal(client.state.calls.length, before);
});
test("unprivileged or runtime-administrative connection cannot plan/apply", async () => {
  for (const change of [
    (s) => (s.authority.role = "treido_runtime"),
    (s) => (s.authority.login = "other_login"),
    (s) => (s.authority.database = "foreign"),
    (s) => (s.authority.can_insert = false),
    (s) => (s.authority.runtime_restricted = false),
    (s) => (s.authority.runtime_write = true),
    (s) => (s.authority.runtime_admin = true),
  ]) {
    const client = fakeClient();
    change(client.state);
    await assert.rejects(
      createMaintenancePlan(client, reviewed()),
      /MAINTENANCE_AUTHORITY_DENIED/,
    );
    assert.equal(client.state.calls.at(-1), "ROLLBACK");
  }
});
test("insert errors roll back, and previously recorded reviews cannot silently create another version", async () => {
  const client = fakeClient();
  const review = reviewed();
  const plan = await createMaintenancePlan(client, review);
  client.state.insertFailure = true;
  await assert.rejects(
    applyMaintenancePlan(client, plan, review),
    /database insert failed/,
  );
  assert.equal(client.state.calls.at(-1), "ROLLBACK");
  client.state.insertFailure = false;
  client.state.recorded = true;
  await assert.rejects(
    createMaintenancePlan(client, review),
    /REVIEW_ALREADY_RECORDED/,
  );
  await assert.rejects(
    applyMaintenancePlan(client, plan, review),
    /REVIEW_ALREADY_RECORDED/,
  );
  assert.equal(client.state.policy.version, 1);
});
