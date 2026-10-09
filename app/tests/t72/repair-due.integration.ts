import { beforeAll, afterAll, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { startLaunchCluster } from "./native-fixture.mjs";
import { applyReviewedMigration } from "../../apps/web/scripts/identity-draft-migration.mjs";
import { applyLifecycleJobGrants } from "../../apps/web/src/server/jobs/lifecycle-grants.mjs";
import { createDatabase } from "../../apps/web/src/server/db/database";
import { readRepairDue } from "../../apps/web/src/server/jobs/repair-due.server";
let native: Awaited<ReturnType<typeof startLaunchCluster>>;
let migration: string;
let tableGrantsBefore: unknown;
const tableGrantsSql =
  "SELECT c.relname,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='treido' ORDER BY c.relname";
const fixtures: Record<string, string> = {
  billing_intents:
    "id uuid,seller_id uuid,state text,first_attempt_at timestamptz,expires_at timestamptz,updated_at timestamptz,operation text",
  billing_subscriptions: "origin_intent_id uuid,retired_at timestamptz",
  outbox_jobs:
    "id uuid,kind text,resource_id uuid,seller_id uuid,state text,operation_key uuid,dispatch_until timestamptz,available_at timestamptz",
  job_effects: "job_id uuid,execution_until timestamptz",
  promotion_metrics: "expires_at timestamptz",
  promotion_attempts: "id uuid,updated_at timestamptz,state text,intent jsonb",
  promotion_campaigns: "id uuid,state text",
  promotion_intervals: "campaign_id uuid,ends_at timestamptz",
  order_refund_intents: "reconcile_at timestamptz,state text",
  payment_attempts: "id uuid,state text,reconcile_at timestamptz",
  payment_refunds: "id uuid,state text,reconcile_at timestamptz",
  buyer_saved_searches: "id uuid,status text,due_at timestamptz",
  buyer_saved_search_runs: "search_id uuid,state text",
  assistant_media_assets: "id uuid,expires_at timestamptz,state text",
  assistant_media_objects:
    "asset_id uuid,state text,write_until timestamptz,retain_until timestamptz",
  assistant_runs:
    "id uuid,user_id uuid,expires_at timestamptz,input_json jsonb,proposal jsonb,accepted_criteria jsonb,state text,emission_started_at timestamptz,provider_id text",
  assistant_run_reservations: "run_id uuid,user_id uuid,status text",
  account_execution_plans:
    "accepted_at timestamptz,state text,acceptance_key uuid",
  order_shipping_choices:
    "id uuid,buyer_id uuid,quote_id uuid,expires_at timestamptz,state text",
  order_shipping_recipients:
    "choice_id uuid,buyer_id uuid,value jsonb,retain_until timestamptz",
  inventory_allocations: "id uuid,state text,expires_at timestamptz",
  listing_offers:
    "id uuid,allocation_id uuid,state text,expires_at timestamptz",
  offer_events: "offer_id uuid,kind text",
  catalogue_imports: "state text,expires_at timestamptz",
  invitation_deliveries:
    "provider_id text,request_payload jsonb,state text,last_checked_at timestamptz,submitted_at timestamptz",
  message_attachment_objects:
    "state text,write_until timestamptz,retain_until timestamptz,deletion_until timestamptz,attachment_id uuid,kind text,object_key text",
  message_attachments:
    "id uuid,object_key text,source_key text,state text,expires_at timestamptz",
  message_attachment_links: "attachment_id uuid",
  seller_invitations: "status text,expires_at timestamptz",
  media_storage_objects:
    "seller_id uuid,asset_id uuid,state text,write_until timestamptz,retain_until timestamptz,available_at timestamptz,deletion_until timestamptz,kind text,object_key text",
  media_assets:
    "seller_id uuid,id uuid,job_id uuid,state text,derivative_key text,expires_at timestamptz,immutable_key text",
};
const id = "'00000000-0000-4000-8000-000000000001'";
const past = "clock_timestamp()-interval '1 hour'";
const branches = {
  billing: `INSERT INTO billing_intents(state,expires_at) VALUES('prepared',${past})`,
  promotion: `INSERT INTO promotion_metrics VALUES(${past})`,
  refund: `INSERT INTO order_refund_intents VALUES(${past},'prepared')`,
  payment: `INSERT INTO payment_attempts VALUES(${id},'creating',${past})`,
  search: `INSERT INTO buyer_saved_searches VALUES(${id},'enabled',${past})`,
  assistant: `INSERT INTO assistant_runs(id,user_id,expires_at,emission_started_at,provider_id) VALUES(${id},${id},clock_timestamp()+interval '1 hour',${past},'synthetic-voice'); INSERT INTO assistant_run_reservations VALUES(${id},${id},'unknown')`,
  closure: `INSERT INTO account_execution_plans VALUES(${past},'accepted',${id})`,
  shipping: `INSERT INTO order_shipping_choices VALUES(${id},${id},NULL,${past},'prepared'); INSERT INTO order_shipping_recipients VALUES(${id},${id},'{}',${past})`,
  outbox: `INSERT INTO outbox_jobs(state,available_at) VALUES('accepted',${past})`,
  inventory: `INSERT INTO inventory_allocations VALUES(${id},'active',${past})`,
  offers: `INSERT INTO listing_offers VALUES(${id},NULL,'expired',NULL)`,
  imports: `INSERT INTO catalogue_imports VALUES('uploading',${past})`,
  mail: "INSERT INTO invitation_deliveries(provider_id,request_payload,state,submitted_at) VALUES('synthetic','{}','submitted',clock_timestamp())",
  images: `INSERT INTO message_attachment_objects(state,write_until,retain_until) VALUES('deleting',${past},${past})`,
  invitations: `INSERT INTO seller_invitations VALUES('pending',${past})`,
  photos: `INSERT INTO media_assets(seller_id,id,state) VALUES(${id},${id},'failed'); INSERT INTO media_storage_objects(seller_id,asset_id,state,write_until,retain_until,available_at,kind) VALUES(${id},${id},'deleting',${past},${past},${past},'staging')`,
  activeSubscription: `INSERT INTO billing_intents(id,state,updated_at) VALUES(${id},'complete',${past}); INSERT INTO billing_subscriptions VALUES(${id},NULL)`,
  promotionAttempt: `INSERT INTO promotion_attempts VALUES(${id},${past},'prepared','{"checkoutExpiresAt":"2000-01-01T00:00:00Z"}')`,
  promotionInterval: `INSERT INTO promotion_campaigns VALUES(${id},'paused'); INSERT INTO promotion_intervals VALUES(${id},${past})`,
  paymentRefund: `INSERT INTO payment_refunds VALUES(${id},'pending',${past})`,
  assistantMedia: `INSERT INTO assistant_media_assets VALUES(${id},${past},'staged'); INSERT INTO assistant_media_objects VALUES(${id},'deleting',${past},${past})`,
  assistantRunExpiry: `INSERT INTO assistant_runs(id,user_id,expires_at,input_json,state) VALUES(${id},${id},${past},'{}','failed'); INSERT INTO assistant_run_reservations VALUES(${id},${id},'failed')`,
  pendingOffer: `INSERT INTO listing_offers VALUES(${id},NULL,'pending',${past})`,
  heldOffer: `INSERT INTO inventory_allocations VALUES(${id},'expired',${past}); INSERT INTO listing_offers VALUES(${id},${id},'accepted',NULL)`,
  boundShipping: `INSERT INTO order_shipping_choices VALUES(${id},${id},${id},NULL,'bound'); INSERT INTO order_shipping_recipients VALUES(${id},${id},'{}',${past})`,
  expiredLease: `INSERT INTO outbox_jobs(id,state,available_at,dispatch_until) VALUES(${id},'pending',${past},${past}); INSERT INTO job_effects VALUES(${id},${past})`,
};
beforeAll(async () => {
  native = await startLaunchCluster({
    messageImageDispatch: true,
    evidenceDirectory:
      process.env.TREIDO_NATIVE_EVIDENCE_DIRECTORY ??
      resolve(
        import.meta.dirname,
        "../../../.qa/launch-jobs-cost-20261006/native",
      ),
  });
  const client = await native.admin.connect();
  try {
    for (const file of [
      "0051_assistant_voice_usage.sql",
      "0052_repair_due.sql",
    ]) {
      const sql = await readFile(
        resolve(import.meta.dirname, "../../apps/web/migrations", file),
        "utf8",
      );
      await applyReviewedMigration(client, file.slice(0, -4), sql);
      if (file.startsWith("0052")) migration = sql;
    }
    tableGrantsBefore = (await client.query(tableGrantsSql)).rows;
    await applyLifecycleJobGrants(client, "treido_runtime");
    await client.query(
      "CREATE ROLE repair_outsider; GRANT USAGE ON SCHEMA treido TO repair_outsider; CREATE SCHEMA repair_fixture",
    );
    for (const [table, columns] of Object.entries(fixtures))
      await client.query(`CREATE TABLE repair_fixture.${table}(${columns})`);
    // Predicate-only fixture removes entity constraints, never production authority.
    await client.query(migration.replaceAll("treido", "repair_fixture"));
  } finally {
    client.release();
  }
});
afterAll(async () => {
  if (native) await native.stop();
});
it("qualifies full51 schema, boolean-only definer, runtime and outsider permissions", async () => {
  expect((await native.admin.query(tableGrantsSql)).rows).toEqual(
    tableGrantsBefore,
  );
  expect(await readRepairDue(createDatabase(native.runtime))).toEqual({
    version: 1,
    due: false,
  });
  const row = (
    await native.admin.query(
      "SELECT p.prosecdef,p.proconfig,p.prorettype::regtype::text AS result,p.proowner=(SELECT proowner FROM pg_proc WHERE oid='treido.account_repair_closure(integer)'::regprocedure) AS same_owner,has_function_privilege('repair_outsider','treido.repair_any_due_v1()','EXECUTE') AS outsider FROM pg_proc p WHERE p.oid='treido.repair_any_due_v1()'::regprocedure",
    )
  ).rows[0];
  expect(row).toEqual({
    prosecdef: true,
    proconfig: ["search_path=pg_catalog, treido"],
    result: "boolean",
    same_owner: true,
    outsider: false,
  });
  const runtime = await native.runtime.connect();
  try {
    await runtime.query("BEGIN; SET LOCAL transaction_read_only=on");
    expect(
      (await runtime.query("SELECT treido.repair_any_due_v1() AS due")).rows[0]
        .due,
    ).toBe(false);
    await expect(
      runtime.query(
        "UPDATE treido.account_execution_plans SET state='accepted'",
      ),
    ).rejects.toThrow(/permission denied|read-only/);
  } finally {
    await runtime.query("ROLLBACK");
    runtime.release();
  }
  const client = await native.admin.connect();
  try {
    await client.query("SET ROLE repair_outsider");
    await expect(
      client.query("SELECT treido.repair_any_due_v1()"),
    ).rejects.toThrow(/permission denied/);
  } finally {
    await client.query("RESET ROLE");
    client.release();
  }
});
it("completed jobs and already retained visible bytes do not fabricate due work", async () => {
  const client = await native.admin.connect();
  try {
    await client.query(
      "BEGIN; SET LOCAL search_path=repair_fixture,pg_catalog",
    );
    await client.query(
      `INSERT INTO outbox_jobs(state,available_at) VALUES('completed',${past}); INSERT INTO seller_invitations VALUES('expired',${past}); INSERT INTO catalogue_imports VALUES('completed',${past}); INSERT INTO payment_refunds VALUES(${id},'succeeded',${past}); INSERT INTO media_assets(seller_id,id,state,derivative_key) VALUES(${id},${id},'ready','visible'); INSERT INTO media_storage_objects(seller_id,asset_id,state,write_until,retain_until,available_at,kind,object_key) VALUES(${id},${id},'tracked',${past},${past},${past},'ready','visible')`,
    );
    expect(
      (await client.query("SELECT repair_fixture.repair_any_due_v1() AS due"))
        .rows[0].due,
    ).toBe(false);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
for (const [family, sql] of Object.entries(branches))
  it(`detects maintenance-only ${family} without a preexisting dispatch job`, async () => {
    const client = await native.admin.connect();
    try {
      await client.query(
        "BEGIN; SET LOCAL search_path=repair_fixture,pg_catalog",
      );
      expect(
        (await client.query("SELECT repair_fixture.repair_any_due_v1() AS due"))
          .rows[0].due,
      ).toBe(false);
      await client.query(sql);
      expect(
        (await client.query("SELECT repair_fixture.repair_any_due_v1() AS due"))
          .rows[0].due,
      ).toBe(true);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
it("newly committed/future due work is observed on the next snapshot using database time", async () => {
  const client = await native.admin.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO repair_fixture.catalogue_imports VALUES('uploading',clock_timestamp()+interval '1 hour')",
    );
    expect(
      (await client.query("SELECT repair_fixture.repair_any_due_v1() AS due"))
        .rows[0].due,
    ).toBe(false);
    await client.query(
      "UPDATE repair_fixture.catalogue_imports SET expires_at=clock_timestamp()-interval '1 second'",
    );
    expect(
      (await client.query("SELECT repair_fixture.repair_any_due_v1() AS due"))
        .rows[0].due,
    ).toBe(true);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
