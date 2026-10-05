import { expect } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { SellerTransaction } from "../../apps/web/src/server/db/database";
import { inTransaction } from "../../apps/web/src/server/db/database";
import { createPublicationFixture } from "../../apps/web/tests/fixtures/publication-flow";
import { createMediaIntent, completeMediaUpload } from "../../apps/web/src/features/selling/media.server";
import { changeInventory } from "../../apps/web/src/features/inventory/commands.server";
import { publishListing } from "../../apps/web/src/features/selling/publish.server";
import { readSavedSearches } from "../../apps/web/src/features/saved-searches/queries.server";
import { changeSavedSearch } from "../../apps/web/src/features/saved-searches/commands.server";
import { reviewedCriteria } from "../../apps/web/src/features/saved-searches/model";
import { parseToolIntent } from "../../apps/web/src/features/shopping-tools/intent";
import { changeClosure } from "../../apps/web/src/features/account-closure/commands.server";
import { actorKey } from "../../apps/web/src/features/account-closure/storage.server";
import { jobColumns, type JobRow } from "../../apps/web/src/server/jobs/outbox.server";
import { enqueuePaymentObservation } from "../../apps/web/src/features/payments/attempts.server";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import { prepareOrderRefund, executeOrderRefund } from "../../apps/web/src/features/order-aftercare/refund-commands.server";
import { readRefundIntent } from "../../apps/web/src/features/order-aftercare/refund-storage.server";
import { createLifecycleActor, createLifecycleRegistry, createLifecyclePlan, type LifecycleNativeContext } from "./lifecycle-fixture";
import { aftercareActor, aftercareNamespace, aftercareLocalTransport, createAftercareFixture, installAftercareAdapters } from "./aftercare-fixture";
import type { ExecutorCompletionFixture, ExecutorCompletionKind } from "./executor-completion-cases";

export type ExecutorFixtureContext = LifecycleNativeContext & { registerCleanup: (cleanup: () => void | Promise<void>) => void };
const snapshot = async (tx: SellerTransaction, sql: string, parameters: unknown[]) => {
  const row = (await tx.client.query<{ value: unknown }>(sql, parameters)).rows[0];
  if (!row) throw new Error("Missing original native fixture domain projection");
  return row.value;
};

/** Every invocation creates fresh actual relational resources through original
 * feature commands. Only known-object recent proof, target metadata, prior-paid
 * evidence, empty session inventory and explicit local transports are synthetic.
 * No original processor, authority, callback, SQL function or money lock is mocked.
 */
export async function createExecutorCompletionFixture(context: ExecutorFixtureContext, kind: ExecutorCompletionKind): Promise<ExecutorCompletionFixture> {
  const { database, admin } = context;
  const binding = aftercareNamespace;
  const eventFor = async (jobId: string) => {
    const row = (await admin.query<JobRow>(`SELECT ${jobColumns} FROM treido.outbox_jobs WHERE id=$1`, [jobId])).rows[0];
    if (!row || row.kind !== kind) throw new Error("Wrong original executor fixture job");
    return { jobId: row.id, sellerId: row.sellerId, ...(row.buyerId ? { buyerId: row.buyerId } : {}), generation: row.generation, schemaVersion: 1 as const, ...binding };
  };

  if (kind === "account.closure") {
    const owner = await createLifecycleActor(context, true), rules = await createLifecycleRegistry(context);
    const plan = await createLifecyclePlan(context, owner, rules);
    const confirmationKey = randomUUID();
    const confirmation = await changeClosure(database, owner.identity, { version: 1, actorKey: actorKey(owner.identity), requestId: confirmationKey, expectedRevision: 0,
      operation: { kind: "confirm", planId: plan.id, planHash: plan.hash, acknowledged: true } });
    expect(confirmation.acknowledgment.state).toBe("accepted");
    // Retain-only policy plus explicit complete empty session inventory has no
    // effect target. We never fabricate confirmed Clerk/media/provider outcomes.
    const checked = (await admin.query(`SELECT jsonb_array_length(payload->'targets') AS targets,(SELECT count(*)::int FROM treido.account_lifecycle_effects WHERE plan_id=$1) AS effects FROM treido.account_execution_plans WHERE id=$1`, [plan.id])).rows[0];
    expect(checked).toEqual({ targets: 0, effects: 0 });
    const job = (await admin.query<{ id: string }>("SELECT id FROM treido.outbox_jobs WHERE kind='account.closure' AND resource_id=$1", [plan.id])).rows[0];
    if (!job) throw new Error("Original accepted closure was not enqueued");
    return { database, admin, binding, event: await eventFor(job.id),
      domainSnapshot: tx => snapshot(tx, `SELECT jsonb_build_object('humanState',u.status,'personalState',s.status,'planState',p.state,'plan',to_jsonb(p),'personal',to_jsonb(s),'statusEvents',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM treido.account_lifecycle_status_events e WHERE e.user_id=u.id),'[]'::jsonb),'receipts',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.accepted_revision) FROM treido.account_lifecycle_receipts r WHERE r.user_id=u.id),'[]'::jsonb)) AS value FROM treido.users u JOIN treido.account_execution_plans p ON p.user_id=u.id JOIN treido.seller_accounts s ON s.id=$3 WHERE u.id=$1 AND p.id=$2`, [owner.userId, plan.id, owner.sellerId]),
      assertApplied: (before, after) => {
        expect(before).toMatchObject({ humanState: "restricted", personalState: "restricted", planState: "accepted" });
        expect(after).toMatchObject({ humanState: "closed", personalState: "closed", planState: "completed", plan: { acceptance_key: confirmationKey } });
      },
    };
  }

  if (kind === "buyer.saved-search") {
    const merchant = await aftercareActor(context), buyer = await aftercareActor(context), client = await admin.connect();
    let publication: Awaited<ReturnType<typeof createPublicationFixture>>;
    try { publication = await createPublicationFixture({ database, admin: client, owner: merchant.identity }, "business"); }
    finally { client.release(); }
    const stock = await changeInventory(database, merchant.identity, { sellerId: publication.sellerId, listingId: publication.draft.id, requestId: randomUUID(), expectedRevision: 0,
      operation: { kind: "setup", mode: "unique", onHand: 1, sellerSku: "T61-executor-search" } });
    await publishListing(database, merchant.identity, { ...publication.input, expectedRevision: stock.listingRevision });
    const view = await readSavedSearches(database, buyer.identity);
    const saved = await changeSavedSearch(database, buyer.identity, { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(),
      operation: { kind: "save", name: "T61 original executor notification", criteria: reviewedCriteria(parseToolIntent("category=cat%3Aelectronics%2Fphones&currency=EUR&minPrice=129&maxPrice=129&availability=known", "find-for-me"), "find-for-me"), enable: true, frequency: 60 } });
    const job = (await admin.query<{ id: string; resource_id: string }>(`SELECT j.id,j.resource_id FROM treido.outbox_jobs j JOIN treido.buyer_saved_search_runs r ON r.id=j.resource_id WHERE j.kind='buyer.saved-search' AND r.user_id=$1 AND r.search_id=$2`, [buyer.userId, saved.searchId])).rows[0];
    if (!job) throw new Error("Original saved-search step not enqueued");
    return { database, admin, binding, event: await eventFor(job.id),
      domainSnapshot: tx => snapshot(tx, `SELECT jsonb_build_object('run',to_jsonb(r),'search',to_jsonb(s),'observations',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.listing_id) FROM treido.buyer_search_observations o WHERE o.user_id=$1 AND o.search_id=s.id),'[]'::jsonb),'notifications',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.id) FROM treido.buyer_search_notifications n WHERE n.user_id=$1 AND n.search_id=s.id),'[]'::jsonb),'targetNotificationCount',(SELECT count(*)::int FROM treido.buyer_search_notifications n WHERE n.user_id=$1 AND n.search_id=s.id AND n.listing_id=$3 AND n.kind='new_publication')) AS value FROM treido.buyer_saved_search_runs r JOIN treido.buyer_saved_searches s ON s.id=r.search_id WHERE r.user_id=$1 AND r.id=$2`, [buyer.userId, job.resource_id, publication.draft.id]),
      assertApplied: (before, after) => {
        expect(before).toMatchObject({ run: { step: 0, observed: 0 }, targetNotificationCount: 0, notifications: [] });
        expect(after).toMatchObject({ run: { step: 1 }, targetNotificationCount: 1, notifications: expect.arrayContaining([expect.objectContaining({ listing_id: publication.draft.id, kind: "new_publication", consent_generation: 1 })]) });
      },
    };
  }

  if (kind === "media.process") {
    const owner = await aftercareActor(context), client = await admin.connect();
    let publication: Awaited<ReturnType<typeof createPublicationFixture>>;
    try { publication = await createPublicationFixture({ database, admin: client, owner: owner.identity }, "business"); }
    finally { client.release(); }
    const staged = (await admin.query<{ staging_key: string }>("SELECT staging_key FROM treido.media_assets WHERE id=$1", [publication.assetId])).rows[0];
    const bytes = publication.objects.get(staged.staging_key);
    if (!bytes) throw new Error("Original generated publication bytes missing");
    const intent = await createMediaIntent(database, owner.identity, { sellerId: publication.sellerId, draftId: publication.draft.id, requestId: randomUUID(),
      bytes: bytes.length, contentType: "image/png", checksum: createHash("sha256").update(bytes).digest("hex") }, publication.storage);
    const asset = (await admin.query<{ staging_key: string }>("SELECT staging_key FROM treido.media_assets WHERE id=$1", [intent.assetId])).rows[0];
    publication.objects.set(asset.staging_key, Buffer.from(bytes));
    await completeMediaUpload(database, owner.identity, { sellerId: publication.sellerId, draftId: publication.draft.id, assetId: intent.assetId }, publication.storage);
    const job = (await admin.query<{ job_id: string }>("SELECT job_id FROM treido.media_assets WHERE id=$1", [intent.assetId])).rows[0];
    return { database, admin, binding, event: await eventFor(job.job_id), mediaStorage: publication.storage,
      domainSnapshot: tx => snapshot(tx, "SELECT jsonb_build_object('asset',to_jsonb(a),'draftPublication',l.publication) AS value FROM treido.media_assets a JOIN treido.listings l ON l.id=a.listing_id WHERE a.id=$1", [intent.assetId]),
      assertApplied: (before, after) => {
        expect(before).toMatchObject({ asset: { state: "processing", revision: 2 }, draftPublication: "draft" });
        expect(after).toMatchObject({ asset: { state: "ready", revision: 3, width: 600, height: 480, derivative_key: expect.any(String), derivative_checksum: expect.stringMatching(/^[a-f0-9]{64}$/) }, draftPublication: "draft" });
      },
    };
  }

  const local = aftercareLocalTransport();
  context.registerCleanup(installAftercareAdapters(local));
  const paid = await createAftercareFixture(context, local);
  if (kind === "payment.reconcile") {
    const id = await inTransaction(database, tx => enqueuePaymentObservation(tx, paid.attemptId, paid.sellerId));
    return { database, admin, binding, event: await eventFor(id),
      domainSnapshot: tx => snapshot(tx, `SELECT jsonb_build_object('attempt',to_jsonb(a),'order',to_jsonb(o),'allocation',to_jsonb(i),'facts',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.kind,f.object_id) FROM treido.payment_facts f WHERE f.attempt_id=a.id),'[]'::jsonb),'factCount',(SELECT count(*)::int FROM treido.payment_facts f WHERE f.attempt_id=a.id)) AS value FROM treido.payment_attempts a JOIN treido.paid_orders o ON o.attempt_id=a.id JOIN treido.inventory_allocations i ON i.id=$2 WHERE a.id=$1`, [paid.attemptId, paid.allocationId]),
      assertApplied: (before, after) => {
        expect(before).toMatchObject({ attempt: { state: "paid" }, order: { payment_state: "paid", fulfilment_state: "collected" }, allocation: { state: "consumed" }, factCount: 1 });
        expect(after).toMatchObject({ attempt: { state: "paid", observed_at: expect.any(String) }, order: { payment_state: "paid", fulfilment_state: "collected", settlement_state: "transferred" }, allocation: { state: "consumed" }, factCount: 4 });
        expect(local.counts().posts).toBe(0);
        expect(local.counts().gets).toBeGreaterThan(0);
      },
    };
  }

  const prepared = await prepareOrderRefund(database, paid.merchant.identity, { actorKey: libraryActorKey(paid.merchant.identity), orderId: paid.orderId, sellerId: paid.sellerId, requestId: randomUUID(), expectedRevision: 0,
    language: "en", action: "prepare_refund", caseId: null, reason: "SYNTHETIC original executor refund", selection: "lines", lines: [{ skuId: paid.skuId, quantity: 1 }] });
  if (!prepared.intentId) throw new Error("Original refund did not reserve an intent");
  await executeOrderRefund(database, paid.merchant.identity, { actorKey: libraryActorKey(paid.merchant.identity), orderId: paid.orderId, sellerId: paid.sellerId, requestId: randomUUID(), expectedRevision: 0,
    language: "en", action: "execute_refund", intentId: prepared.intentId });
  const original = await inTransaction(database, tx => readRefundIntent(tx, prepared.intentId!));
  if (!original) throw new Error("Original accepted refund missing");
  local.succeed(original);
  expect(local.counts().posts).toBe(1);
  const job = (await admin.query<{ id: string }>("SELECT id FROM treido.outbox_jobs WHERE kind='payment.aftercare' AND resource_id=$1", [prepared.intentId])).rows[0];
  if (!job) throw new Error("Original accepted refund observation not enqueued");
  return { database, admin, binding, event: await eventFor(job.id),
    domainSnapshot: tx => snapshot(tx, `SELECT jsonb_build_object('refund',to_jsonb(r),'order',to_jsonb(o),'allocation',to_jsonb(i),'sku',to_jsonb(s),'observations',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM treido.order_refund_observations v WHERE v.intent_id=r.id),'[]'::jsonb)) AS value FROM treido.order_refund_intents r JOIN treido.paid_orders o ON o.id=r.order_id JOIN treido.payable_quotes q ON q.id=r.quote_id AND q.id=o.quote_id JOIN treido.inventory_allocations i ON i.id=q.allocation_id JOIN treido.inventory_skus s ON s.id=$2 WHERE r.id=$1`, [prepared.intentId, paid.skuId]),
    assertApplied: (before, after) => {
        expect(before).toMatchObject({ refund: { state: "reconciling", amount_minor: 12900, fee_minor: 129 }, allocation: { state: "consumed" }, sku: { on_hand: 7 }, observations: [] });
      expect(after).toMatchObject({ refund: { state: "succeeded", provider_status: "succeeded", settlement_state: "verified", amount_minor: 12900, fee_minor: 129 }, order: { payment_state: "paid", fulfilment_state: "blocked" }, allocation: { state: "consumed" }, sku: { on_hand: 7 }, observations: expect.arrayContaining([expect.objectContaining({ provider_status: "succeeded", amount_minor: 12900, settlement_state: "verified" })]) });
      expect(local.counts().posts).toBe(1);
      expect(local.counts().gets).toBeGreaterThan(0);
    },
  };
}
