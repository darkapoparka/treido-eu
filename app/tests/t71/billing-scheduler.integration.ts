import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { startBillingSchedulerFixture } from "./billing-scheduler-fixture.mjs";
import {
  createDatabase,
  type SellerDatabase,
} from "../../apps/web/src/server/db/database";
import { scheduleBillingRepair } from "../../apps/web/src/features/seller-billing/jobs.server";

let native: Awaited<ReturnType<typeof startBillingSchedulerFixture>>;
let database: SellerDatabase;
beforeAll(async () => {
  native = await startBillingSchedulerFixture();
  database = createDatabase(native.runtime);
});
afterAll(async () => {
  await native?.stop();
});
beforeEach(async () => {
  await native.admin.query(
    "TRUNCATE treido.billing_catalogue,treido.users CASCADE",
  );
});

// Synthetic persistence fixtures, never identity/session or provider responses.
async function origins(count: number) {
  const actorId = randomUUID(),
    catalogueId = randomUUID();
  await native.admin.query(
    "INSERT INTO treido.users(id,clerk_subject) VALUES($1,'t71_scheduler_fixture')",
    [actorId],
  );
  await native.admin.query(
    `INSERT INTO treido.billing_catalogue(id,plan_id,version,seller_kind,platform_account,livemode,environment,application_id,product_id,price_id,amount_minor,currency,limits,terms,terms_version,tax_policy,change_configuration,portal_configuration,approved_at)
    VALUES($1,'business_pro',1,'business','acct_T71Synthetic',false,'test','t71-synthetic','prod_T71Synthetic','price_T71Synthetic',2499,'EUR','{}','{"bg":"ТЕСТ","en":"TEST"}','T71 FIXTURE','automatic','bpc_T71Synthetic','bpc_T71Synthetic',clock_timestamp())`,
    [catalogueId],
  );
  const rows: { id: string; sellerId: string; customerId: string }[] = [];
  for (let index = 1; index <= count; index++) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    const sellerId = randomUUID(),
      customerId = randomUUID();
    await native.admin.query(
      "INSERT INTO treido.seller_accounts(id,kind,name,created_by) VALUES($1,'business','T71 synthetic scheduler',$2)",
      [sellerId, actorId],
    );
    await native.admin.query(
      "INSERT INTO treido.billing_customers(id,seller_id,platform_account,livemode,environment,application_id,provider_id,approved_at) VALUES($1,$2,'acct_T71Synthetic',false,'test','t71-synthetic',$3,clock_timestamp())",
      [customerId, sellerId, `cus_T71Synthetic${index}`],
    );
    await native.admin.query(
      `INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,created_at,expires_at,state,updated_at,provider_id)
      VALUES($1,$2,$3,$4,repeat('a',64),'checkout',$5,$6,'price_T71Synthetic','{}',repeat('a',64),$7,'T71 SYNTHETIC',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour','complete',clock_timestamp()-interval '5 minutes',$8)`,
      [
        id,
        sellerId,
        actorId,
        randomUUID(),
        catalogueId,
        customerId,
        `t71:${id}`,
        `cs_T71Synthetic${index}`,
      ],
    );
    await native.admin.query(
      "INSERT INTO treido.billing_subscriptions(id,seller_id,customer_binding_id,provider_id,origin_intent_id,catalogue_id,item_id,state) VALUES($1,$2,$3,$4,$5,$6,$7,'active')",
      [
        randomUUID(),
        sellerId,
        customerId,
        `sub_T71Synthetic${index}`,
        id,
        catalogueId,
        `si_T71Synthetic${index}`,
      ],
    );
    rows.push({ id, sellerId, customerId });
  }
  return rows;
}
const queued = async () =>
  (
    await native.admin.query<{
      resourceId: string;
      sellerId: string;
      authority: string;
      actorId: null;
    }>(
      `SELECT resource_id AS "resourceId",seller_id AS "sellerId",authority,actor_id AS "actorId" FROM treido.outbox_jobs WHERE kind='billing.reconcile' AND state='pending' ORDER BY resource_id`,
    )
  ).rows;
// Simulated executor completion in the test database, with no provider evidence.
const completeJobs = () =>
  native.admin
    .query(`UPDATE treido.job_effects SET state='completed',completed_at=clock_timestamp()
  WHERE job_id IN (SELECT id FROM treido.outbox_jobs WHERE state='pending');
  UPDATE treido.outbox_jobs SET state='completed',completed_at=clock_timestamp() WHERE state='pending'`);

describe("T71 fair billing repair on isolated PostgreSQL with runtime billing grants", () => {
  it("reaches the 21st subscription after completed jobs, even when the first 20 are due again", async () => {
    const rows = await origins(21);
    const immutable = async () =>
      (
        await native.admin.query(
          "SELECT to_jsonb(i)-'updated_at' AS intent FROM treido.billing_intents i ORDER BY id",
        )
      ).rows;
    const before = await immutable();
    expect(await scheduleBillingRepair(database)).toBe(20);
    const first = await queued();
    expect(first.map((row) => row.resourceId)).toEqual(
      rows.slice(0, 20).map((row) => row.id),
    );
    expect(first).toEqual(
      rows.slice(0, 20).map((row) => ({
        resourceId: row.id,
        sellerId: row.sellerId,
        authority: "service",
        actorId: null,
      })),
    );
    await completeJobs();
    // Advance eligibility without sleeping or altering accepted/provider expiry.
    await native.admin.query(
      "UPDATE treido.billing_intents SET updated_at=clock_timestamp()-interval '61 seconds' WHERE id=ANY($1::uuid[])",
      [first.map((row) => row.resourceId)],
    );
    expect(await scheduleBillingRepair(database)).toBe(20);
    const second = await queued();
    expect(second.some((row) => row.resourceId === rows[20].id)).toBe(true);
    expect(
      new Set([...first, ...second].map((row) => row.resourceId)).size,
    ).toBe(21);
    expect(await immutable()).toEqual(before);
  });

  it("keeps the 60-second bound across completion and retries dead jobs without duplicating outstanding jobs", async () => {
    const rows = await origins(3);
    expect(await scheduleBillingRepair(database)).toBe(3);
    await native.admin.query(
      "UPDATE treido.outbox_jobs SET state=CASE WHEN resource_id=$1 THEN 'dead' WHEN resource_id=$2 THEN 'accepted' ELSE 'pending' END",
      [rows[0].id, rows[1].id],
    );
    expect(await scheduleBillingRepair(database)).toBe(0);
    await native.admin.query(
      "UPDATE treido.billing_intents SET updated_at=clock_timestamp()-interval '61 seconds'",
    );
    expect(await scheduleBillingRepair(database)).toBe(1);
    expect(
      (
        await native.admin.query(
          "SELECT resource_id,count(*)::int AS count FROM treido.outbox_jobs GROUP BY resource_id ORDER BY resource_id",
        )
      ).rows.map((row) => row.count),
    ).toEqual([2, 1, 1]);
    await completeJobs();
    // The third original job was scheduled more than 60 seconds ago; its
    // completion does not reset the last-scheduled marker. The retried first
    // origin remains within its fresh bound, and the second is still accepted.
    expect(await scheduleBillingRepair(database)).toBe(1);
    expect((await queued()).map((row) => row.resourceId)).toEqual([rows[2].id]);
    expect(await scheduleBillingRepair(database)).toBe(0);
  });

  it("concurrent sweeps atomically split due work and roll back the marker if enqueue fails", async () => {
    await origins(21);
    const results = await Promise.all([
      scheduleBillingRepair(database),
      scheduleBillingRepair(database),
    ]);
    expect(results.reduce((sum, count) => sum + count, 0)).toBe(21);
    expect(results.every((count) => count <= 20)).toBe(true);
    expect((await queued()).length).toBe(21);
    expect(
      (
        await native.admin.query(
          "SELECT count(DISTINCT resource_id)::int AS count FROM treido.outbox_jobs",
        )
      ).rows[0].count,
    ).toBe(21);
    await completeJobs();
    await native.admin.query(
      "UPDATE treido.billing_intents SET updated_at=clock_timestamp()-interval '61 seconds'",
    );
    const before = (
      await native.admin.query(
        "SELECT id,updated_at FROM treido.billing_intents ORDER BY id",
      )
    ).rows;
    await native.admin.query(
      "REVOKE INSERT ON treido.job_effects FROM t71_billing_runtime",
    );
    try {
      await expect(scheduleBillingRepair(database)).rejects.toMatchObject({
        code: "42501",
      });
      expect(
        (
          await native.admin.query(
            "SELECT id,updated_at FROM treido.billing_intents ORDER BY id",
          )
        ).rows,
      ).toEqual(before);
      expect((await queued()).length).toBe(0);
    } finally {
      await native.admin.query(
        "GRANT INSERT ON treido.job_effects TO t71_billing_runtime",
      );
    }
    expect(await scheduleBillingRepair(database)).toBe(20);
  });

  it("excludes retired origins and does not let another kind or seller suppress a scoped repair", async () => {
    const rows = await origins(3);
    await native.admin.query(
      "UPDATE treido.billing_subscriptions SET retired_at=clock_timestamp() WHERE origin_intent_id=$1",
      [rows[2].id],
    );
    for (const [kind, sellerId, id] of [
      ["system.probe", rows[0].sellerId, rows[0].id],
      ["billing.reconcile", rows[0].sellerId, rows[1].id],
    ]) {
      await native.admin.query(
        "INSERT INTO treido.outbox_jobs(id,kind,seller_id,resource_id,operation_key,intent_hash,authority) VALUES($1,$2,$3,$4,$5,repeat('a',64),'service')",
        [randomUUID(), kind, sellerId, id, randomUUID()],
      );
    }
    expect(await scheduleBillingRepair(database)).toBe(2);
    const jobs = await queued();
    expect(jobs.some((row) => row.resourceId === rows[2].id)).toBe(false);
    for (const row of rows.slice(0, 2))
      expect(
        jobs.some(
          (job) => job.resourceId === row.id && job.sellerId === row.sellerId,
        ),
      ).toBe(true);
  });

  it("defers a seller-first command without holding its intent or waiting on enqueue's foreign key", async () => {
    const [row] = await origins(1);
    const owner = await native.admin.connect();
    await owner.query("BEGIN");
    try {
      await owner.query(
        "SELECT id FROM treido.seller_accounts WHERE id=$1 FOR UPDATE",
        [row.sellerId],
      );
      expect(await scheduleBillingRepair(database)).toBe(0);
      await expect(
        owner.query(
          "SELECT id FROM treido.billing_intents WHERE id=$1 FOR UPDATE NOWAIT",
          [row.id],
        ),
      ).resolves.toMatchObject({ rowCount: 1 });
      expect(await queued()).toEqual([]);
    } finally {
      await owner.query("ROLLBACK");
      owner.release();
    }
    expect(await scheduleBillingRepair(database)).toBe(1);
    expect((await queued()).map((job) => job.resourceId)).toEqual([row.id]);
  });

  it("does not interpret an abandoned ready change's local deadline as provider cancellation", async () => {
    const [origin] = await origins(1);
    const previewId = randomUUID(),
      changeId = randomUUID();
    const insert = async (
      id: string,
      operation: string,
      preview: string | null,
    ) =>
      native.admin.query(
        `INSERT INTO treido.billing_intents
      (id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,subscription_id,preview_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,created_at,expires_at,state,updated_at,provider_id)
      SELECT $1,seller_id,actor_id,$2,input_hash,$3,catalogue_id,customer_binding_id,'sub_T71Synthetic1',$4,expected_price_id,parameters,parameter_hash,$5,api_version,created_at,expires_at,'ready',updated_at,$6
      FROM treido.billing_intents WHERE id=$7`,
        [
          id,
          randomUUID(),
          operation,
          preview,
          `t71:${id}`,
          operation === "change" ? "bps_T71Synthetic" : "in_T71Synthetic",
          origin.id,
        ],
      );
    await insert(previewId, "preview", null);
    await insert(changeId, "change", previewId);
    const before = (
      await native.admin.query(
        "SELECT state,expires_at,idempotency_key,parameters,provider_id FROM treido.billing_intents WHERE id=$1",
        [changeId],
      )
    ).rows[0];
    expect(await scheduleBillingRepair(database)).toBe(2);
    expect(
      (
        await native.admin.query(
          "SELECT state,expires_at,idempotency_key,parameters,provider_id FROM treido.billing_intents WHERE id=$1",
          [changeId],
        )
      ).rows[0],
    ).toEqual(before);
    expect((await queued()).map((row) => row.resourceId).sort()).toEqual(
      [origin.id, changeId].sort(),
    );
    await expect(
      insert(randomUUID(), "change", previewId),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "billing_one_pending_money",
    });
  });
});
