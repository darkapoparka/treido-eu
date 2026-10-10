import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
const structuredClone = globalThis.structuredClone;
import {
  parsePaymentReview,
  parsePaymentPlan,
  paymentMaintenanceHash,
  paymentEligibilitySource,
  paymentProposals,
  readPaymentProviderFacts,
  createPaymentMaintenancePlan,
  applyPaymentMaintenancePlan,
} from "./payment-registry-maintenance-core.mjs";
import {
  qualifiedPaymentConnection,
  paymentMaintenanceArguments,
  runPaymentMaintenance,
} from "./payment-registry-maintenance.mjs";

// Hypothetical test-only attestations, never an actual review or provider account.
const decision = () => ({
  reference: "isolated-test-review-" + randomUUID(),
  reviewedBy: "isolated-test-maintainer",
  reviewedAt: "2026-01-01T00:00:00.000Z",
});
function packet() {
  return {
    format: "treido-test-payment-review-v1",
    target: {
      application: "treido-eu",
      environment: "test",
      projectId: "isolated-test-project",
      branchId: "br-isolated-test",
      database: "treido_test",
      region: "eu-central-1",
      runtimeRole: "treido_runtime",
      maintenanceRole: "treido_maintenance",
      country: "BG",
      appOrigin: "http://127.0.0.1:6500",
      stripeApplicationId: "treido-test",
      stripePlatformAccount: "acct_TestPlatform",
      livemode: false,
    },
    authorizationReference: "isolated-test-authorization",
    policy: {
      id: randomUUID(),
      feeBps: 300,
      feeFixedMinor: 30,
      settlementMerchant: "platform",
      buyerTerms: {
        bg: "Условия само за изолирана тестова проверка.",
        en: "Terms only for an isolated test assertion.",
      },
      decision: decision(),
    },
    mapping: {
      id: randomUUID(),
      sellerId: randomUUID(),
      ownerUserId: randomUUID(),
      connectedAccount: "acct_TestExpress",
      decision: decision(),
    },
    listing: { id: randomUUID(), publicationRevision: 2, decision: decision() },
  };
}
const reviewed = (input = packet()) => {
  const bytes = Buffer.from(JSON.stringify(input));
  return parsePaymentReview(bytes, paymentMaintenanceHash(bytes));
};
function bindings() {
  return {
    TREIDO_ENV: "test",
    TREIDO_DATA_MODE: "database",
    TREIDO_APP_ORIGIN: "http://127.0.0.1:6500",
    TREIDO_NEON_PROJECT_ID: "isolated-test-project",
    TREIDO_NEON_BRANCH_ID: "br-isolated-test",
    TREIDO_NEON_BRANCH_PURPOSE: "test",
    TREIDO_DB_REGION: "eu-central-1",
    TREIDO_DB_DATABASE: "treido_test",
    TREIDO_DB_ROLE: "treido_runtime",
    DATABASE_URL:
      "postgresql://treido_runtime:test-only@ep-isolated-pooler.eu-central-1.aws.neon.tech/treido_test?sslmode=verify-full",
    MIGRATION_DATABASE_URL:
      "postgresql://treido_maintenance:test-only@ep-isolated.eu-central-1.aws.neon.tech/treido_test?sslmode=require",
    TREIDO_STRIPE_MODE: "test",
    TREIDO_STRIPE_APPLICATION_ID: "treido-test",
    TREIDO_STRIPE_PLATFORM_ACCOUNT: "acct_TestPlatform",
    STRIPE_SECRET_KEY: "rk_test_OnlyHypotheticalBoundaryInput",
  };
}
function provider() {
  const platform = {
    id: "acct_TestPlatform",
    country: "BG",
    default_currency: "eur",
    email: "PRIVATE",
    business_profile: { name: "PRIVATE" },
  };
  const connected = {
    id: "acct_TestExpress",
    country: "BG",
    default_currency: "eur",
    type: "express",
    controller: {
      is_controller: true,
      stripe_dashboard: { type: "express" },
      requirement_collection: "stripe",
      fees: { payer: "application" },
      losses: { payments: "application" },
    },
    external_accounts: "PRIVATE",
    requirements: { currently_due: ["business_type"] },
  };
  const calls = [];
  return {
    platform,
    connected,
    calls,
    accounts: {
      async retrieve(id) {
        calls.push(id);
        return id === null ? platform : connected;
      },
    },
  };
}
function client(review) {
  const state = {
    calls: [],
    rows: { policy: [], mapping: [], listing: [] },
    resource: {
      seller: { id: review.packet.mapping.sellerId },
      listing: { id: review.packet.listing.id },
      publication: { revision: 2 },
      category: { version: 1 },
      media: [{ revision: 2 }],
      declaration: null,
    },
    owner: {
      id: review.packet.mapping.ownerUserId,
      status: "active",
      membership_revision: 0,
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
    failInsert: null,
    backup: null,
  };
  const value = (row) => ({ rows: [{ value: row }], rowCount: 1 });
  return {
    state,
    async query(sql, params = []) {
      state.calls.push(sql);
      if (sql.startsWith("BEGIN")) {
        state.backup = structuredClone(state.rows);
        return { rows: [] };
      }
      if (sql === "ROLLBACK") {
        state.rows = state.backup;
        return { rows: [] };
      }
      if (sql === "COMMIT" || sql.startsWith("LOCK")) return { rows: [] };
      if (sql.startsWith("SELECT current_database()"))
        return { rows: [state.authority] };
      if (sql.startsWith("SELECT to_jsonb(s)"))
        return {
          rows: state.resource ? [structuredClone(state.resource)] : [],
        };
      if (sql.startsWith("SELECT u.id"))
        return { rows: state.owner ? [state.owner] : [] };
      if (sql.includes("FROM treido.payment_policies p WHERE id"))
        return { rows: state.rows.policy.map((row) => ({ value: row })) };
      if (sql.includes("FROM treido.seller_payment_bindings b WHERE id"))
        return { rows: state.rows.mapping.map((row) => ({ value: row })) };
      if (sql.includes("FROM treido.payable_listing_terms t WHERE"))
        return { rows: state.rows.listing.map((row) => ({ value: row })) };
      if (sql.startsWith("SELECT (SELECT approved_at"))
        return { rows: [{ active: true }] };
      const tables = {
        payment_policies: "policy",
        seller_payment_bindings: "mapping",
        payable_listing_terms: "listing",
      };
      const table = sql.match(/^INSERT INTO treido\.([a-z_]+)\(([^)]+)\)/);
      if (table) {
        const name = tables[table[1]];
        if (state.failInsert === name)
          throw Error("isolated native-equivalent insert failure");
        const columns = table[2]
          .split(",")
          .filter((column) => column !== "approved_at");
        const row = Object.fromEntries(
          columns.map((column, index) => [
            column,
            column === "buyer_terms"
              ? JSON.parse(params[index])
              : params[index],
          ]),
        );
        Object.assign(row, {
          approved_at: "2026-01-01T00:00:00.000Z",
          revoked_at: null,
        });
        state.rows[name] = [row];
        return value(row);
      }
      throw Error("Unexpected SQL in no-socket boundary test");
    },
  };
}
test("requires raw lowercase hashes and bounded exact JSON", () => {
  const bytes = Buffer.from(JSON.stringify(packet()));
  assert.equal(
    parsePaymentReview(bytes, paymentMaintenanceHash(bytes)).hash.length,
    64,
  );
  for (const hash of [
    "a".repeat(64),
    paymentMaintenanceHash(bytes).toUpperCase(),
  ])
    assert.throws(() => parsePaymentReview(bytes, hash), /INPUT_HASH_MISMATCH/);
  const huge = Buffer.alloc(65537);
  assert.throws(() => parsePaymentReview(huge, paymentMaintenanceHash(huge)));
  const invalid = Buffer.from("not-json");
  assert.throws(
    () => parsePaymentReview(invalid, paymentMaintenanceHash(invalid)),
    /INVALID_JSON/,
  );
  assert.deepEqual(
    parsePaymentPlan(
      Buffer.from("{}"),
      paymentMaintenanceHash(Buffer.from("{}")),
    ),
    {},
  );
});
test("rejects live/Production, ambiguous targets, unknown fields and missing separate decisions", () => {
  for (const change of [
    (p) => (p.target.environment = "production"),
    (p) => (p.target.livemode = true),
    (p) => (p.target.maintenanceRole = p.target.runtimeRole),
    (p) => (p.target.appOrigin = "https://attacker.invalid/path"),
    (p) => (p.mapping.connectedAccount = p.target.stripePlatformAccount),
    (p) => (p.policy.feeBps = 10001),
    (p) => (p.policy.settlementMerchant = null),
    (p) => (p.policy.buyerTerms.en = "TODO terms"),
    (p) => (p.policy.decision.reference = "unapproved"),
    (p) => (p.mapping.decision.reviewedAt = "2026-02-30T00:00:00.000Z"),
    (p) => (p.listing.decision = null),
    (p) => (p.listing.publicationRevision = 1),
    (p) => (p.extra = true),
  ]) {
    const input = packet();
    change(input);
    assert.throws(() => reviewed(input));
  }
});
test("requires explicit CLI mode and help does not use bindings/sockets", async () => {
  assert.equal(
    paymentMaintenanceArguments([
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
    paymentMaintenanceArguments([
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
    assert.throws(() => paymentMaintenanceArguments(args));
  assert.match(
    await runPaymentMaintenance(["--help"], {}),
    /does not enable collection/,
  );
});
test("uses qualified exact target/direct maintenance TLS and intended TEST Stripe namespace", () => {
  const target = packet().target;
  assert.equal(
    new URL(
      qualifiedPaymentConnection(bindings(), target, target.branchId),
    ).searchParams.get("sslmode"),
    "verify-full",
  );
  for (const change of [
    (e) => (e.TREIDO_NEON_BRANCH_ID = "br-other"),
    (e) => (e.TREIDO_STRIPE_MODE = "live"),
    (e) => (e.STRIPE_SECRET_KEY = "sk_live_Other"),
    (e) => (e.TREIDO_STRIPE_APPLICATION_ID = "other-app"),
    (e) => (e.TREIDO_STRIPE_PLATFORM_ACCOUNT = "acct_Other"),
    (e) => (e.TREIDO_APP_ORIGIN = "http://127.0.0.1:6419"),
    (e) => (e.NEXT_PUBLIC_STRIPE_SECRET_KEY = "private"),
    (e) => (e.MIGRATION_DATABASE_URL += "&options=-c%20role%3Dpostgres"),
    (e) =>
      (e.MIGRATION_DATABASE_URL = e.MIGRATION_DATABASE_URL.replace(
        "ep-isolated.",
        "ep-foreign.",
      )),
    (e) =>
      (e.MIGRATION_DATABASE_URL = e.MIGRATION_DATABASE_URL.replace(
        "treido_maintenance:",
        "treido_runtime:",
      )),
  ]) {
    const env = bindings();
    change(env);
    assert.throws(() =>
      qualifiedPaymentConnection(env, target, target.branchId),
    );
  }
});
test("reads only existing platform/Express accounts and exports no private provider data", async () => {
  const stripe = provider(),
    review = reviewed();
  const facts = await readPaymentProviderFacts(stripe, review);
  assert.deepEqual(stripe.calls, [null, "acct_TestExpress"]);
  assert.equal(JSON.stringify(facts).includes("PRIVATE"), false);
  assert.equal(facts.connected.detailsSubmitted, false);
  for (const change of [
    (s) => (s.platform.id = "acct_Other"),
    (s) => (s.connected.country = "US"),
    (s) => (s.connected.default_currency = "usd"),
    (s) => (s.connected.type = "standard"),
    (s) => (s.connected.controller.is_controller = false),
    (s) => (s.connected.controller.requirement_collection = "application"),
  ]) {
    const other = provider();
    change(other);
    await assert.rejects(readPaymentProviderFacts(other, review));
  }
});
test("plan is read-only and binds canonical eligibility/current resources/empty registry facts", async () => {
  const review = reviewed(),
    db = client(review),
    stripe = provider();
  const plan = await createPaymentMaintenancePlan(db, review, stripe);
  assert.equal(
    db.state.calls[0],
    "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  );
  assert.equal(
    db.state.calls.some((sql) => /^(INSERT|UPDATE|DELETE|LOCK)/.test(sql)),
    false,
  );
  assert.equal(plan.eligibilitySourceSha256, paymentEligibilitySource().sha256);
  assert.deepEqual(plan.proposals, paymentProposals(review));
  assert.match(
    plan.proposals.mapping.approval_reference,
    new RegExp(review.hash),
  );
});
test("apply is atomic append-only; exact original replay survives improved onboarding diagnostics", async () => {
  const review = reviewed(),
    db = client(review),
    stripe = provider();
  const plan = await createPaymentMaintenancePlan(db, review, stripe);
  const first = await applyPaymentMaintenancePlan(db, plan, review, stripe);
  assert.equal(first.status, "applied");
  assert.equal(first.collectionChanged, false);
  assert.equal(first.aftercareQualified, false);
  const original = structuredClone(db.state.rows);
  stripe.connected.details_submitted = true;
  stripe.connected.requirements.currently_due = [];
  stripe.connected.payouts_enabled = true;
  assert.equal(
    (await applyPaymentMaintenancePlan(db, plan, review, stripe)).status,
    "already-applied",
  );
  assert.deepEqual(db.state.rows, original);
  assert.equal(
    db.state.calls.filter((sql) => sql.startsWith("INSERT")).length,
    3,
  );
  assert.equal(
    db.state.calls.some((sql) => /^(UPDATE|DELETE)/.test(sql)),
    false,
  );
  await assert.rejects(
    createPaymentMaintenancePlan(db, review, stripe),
    /EXISTING_REGISTRY/,
  );
});
test("stale resource/owner/registry/controller and altered review abort without writes", async () => {
  for (const change of [
    (db) => (db.state.resource.listing.revision = 3),
    (db) => (db.state.owner = null),
    (db) => (db.state.rows.mapping = [{ id: "foreign" }]),
    (_db, stripe) => (stripe.connected.controller.fees.payer = "account"),
    (db) => (db.state.resource = null),
  ]) {
    const review = reviewed(),
      db = client(review),
      stripe = provider();
    const plan = await createPaymentMaintenancePlan(db, review, stripe);
    change(db, stripe);
    await assert.rejects(applyPaymentMaintenancePlan(db, plan, review, stripe));
    assert.equal(
      db.state.calls.filter((sql) => sql.startsWith("INSERT")).length,
      0,
    );
  }
  const review = reviewed(),
    db = client(review),
    stripe = provider(),
    plan = await createPaymentMaintenancePlan(db, review, stripe);
  const changed = structuredClone(review.packet);
  changed.policy.feeBps++;
  await assert.rejects(
    applyPaymentMaintenancePlan(db, plan, reviewed(changed), stripe),
    /PLAN_REVIEW_MISMATCH/,
  );
});
test("all runtime write/admin/authority failures deny plan and apply", async () => {
  for (const change of [
    (a) => (a.runtime_write = true),
    (a) => (a.runtime_admin = true),
    (a) => (a.can_insert = false),
    (a) => (a.runtime_restricted = false),
    (a) => (a.login = "treido_runtime"),
  ]) {
    const review = reviewed(),
      db = client(review),
      stripe = provider();
    const plan = await createPaymentMaintenancePlan(db, review, stripe);
    change(db.state.authority);
    await assert.rejects(
      createPaymentMaintenancePlan(db, review, stripe),
      /MAINTENANCE_AUTHORITY_DENIED/,
    );
    await assert.rejects(
      applyPaymentMaintenancePlan(db, plan, review, stripe),
      /MAINTENANCE_AUTHORITY_DENIED/,
    );
    assert.deepEqual(db.state.rows, { policy: [], mapping: [], listing: [] });
  }
});
test("failure at the last INSERT rolls back both earlier records", async () => {
  const review = reviewed(),
    db = client(review),
    stripe = provider(),
    plan = await createPaymentMaintenancePlan(db, review, stripe);
  db.state.failInsert = "listing";
  await assert.rejects(
    applyPaymentMaintenancePlan(db, plan, review, stripe),
    /insert failure/,
  );
  assert.deepEqual(db.state.rows, { policy: [], mapping: [], listing: [] });
  assert.equal(db.state.calls.at(-1), "ROLLBACK");
});
