import { randomUUID } from "node:crypto";
import { inTransaction } from "../../apps/web/src/server/db/database";
import { executeJob } from "../../apps/web/src/server/jobs/execution.server";
import { jobColumns, type SellerJobRow } from "../../apps/web/src/server/jobs/outbox.server";
import { paymentBindings } from "../../apps/web/src/features/payments/bindings.server";
import { attemptColumns, type AttemptRow } from "../../apps/web/src/features/payments/attempts.server";
import { paymentFacts } from "../../apps/web/src/features/payments/settlement.server";
import { processOrderRefund } from "../../apps/web/src/features/order-aftercare/jobs.server";
import type { AftercareFixtureName, AftercareNativeFixture } from "../../apps/web/src/features/order-aftercare/boundary-integration-cases";
import type { AftercareRegistryFixture } from "../../apps/web/src/features/order-aftercare/registry-integration-cases";
import { submitOrderFeedback } from "../../apps/web/src/features/order-feedback/commands.server";
import { moderateOrderFeedback } from "../../apps/web/src/features/order-feedback/moderation.server";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import { aftercareActor, aftercareNamespace, aftercareLocalTransport, createAftercareFixture, installAftercareAdapters } from "./aftercare-fixture";
import type { ExecutorFixtureContext } from "./executor-completion-fixture";

export async function runOriginalRefundJob(context: ExecutorFixtureContext, intentId: string) {
  const row = (await context.admin.query<SellerJobRow>(`SELECT ${jobColumns} FROM treido.outbox_jobs WHERE kind='payment.aftercare' AND resource_id=$1 ORDER BY created_at DESC LIMIT 1`, [intentId])).rows[0];
  if (!row) throw Error("Original accepted refund job missing");
  await executeJob(context.database, { jobId: row.id, sellerId: row.sellerId, generation: row.generation, schemaVersion: 1, ...aftercareNamespace }, aftercareNamespace, randomUUID(), {
    "payment.aftercare": job => processOrderRefund(context.database, job),
  });
}

export async function createOwnerAftercareFixture(context: ExecutorFixtureContext, name: AftercareFixtureName): Promise<AftercareNativeFixture> {
  const local = aftercareLocalTransport();
  context.registerCleanup(installAftercareAdapters(local));
  const f = await createAftercareFixture(context, local, { acceptAftercare: name !== "legacy-no-partial",
    sellerKind: name === "accepted-after-restriction" || name === "first-settlement-inactive" ? "personal" : "business",
    paidEvidence: name !== "first-settlement-inactive" });
  const foreign = await aftercareActor(context);
  if (name === "public-restricted" || name === "public-withdrawn") {
    const feedback = await submitOrderFeedback(context.database, f.buyer.identity, { actorKey: libraryActorKey(f.buyer.identity), orderId: f.orderId, sellerId: null, requestId: randomUUID(),
      expectedRevision: 0, language: "en", rating: 4, body: "SYNTHETIC current supply gate", policyId: f.feedbackId, version: 1, termsHash: f.feedbackHash, acknowledged: true });
    const moderator = await aftercareActor(context);
    await context.admin.query("INSERT INTO treido.order_aftercare_operator_grants(user_id,capability,environment,application_id,approved_at,approval_reference) VALUES($1,'feedback.moderate','test',$2,clock_timestamp(),'SYNTHETIC ISOLATED T61 ONLY')", [moderator.userId, aftercareNamespace.applicationId]);
    await moderateOrderFeedback(context.database, moderator.identity, { actorKey: libraryActorKey(moderator.identity), feedbackId: feedback.feedbackId, requestId: randomUUID(), expectedRevision: 0, decision: "publish", reason: "SYNTHETIC explicit operator moderation" });
  }
  const row = await inTransaction(context.database, async tx => (await tx.client.query<AttemptRow>(`SELECT ${attemptColumns} FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE a.id=$1`, [f.attemptId])).rows[0]);
  const intent = await local.stripe.paymentIntents.retrieve(f.paymentIntentId);
  const observation = await paymentFacts(local.stripe, row, intent);
  const order = (await context.admin.query<{ revision: number }>("SELECT revision FROM treido.paid_orders WHERE id=$1", [f.orderId])).rows[0];
  if (name !== "first-settlement-inactive" && !order) throw Error("Original synthetic prior paid order missing");
  return { database: context.database, admin: context.admin, buyer: f.buyer.identity, merchant: f.merchant.identity, foreign: foreign.identity,
    buyerId: f.buyer.userId, merchantId: f.merchant.userId, sellerId: f.sellerId, orderId: f.orderId, quoteId: f.quoteId, attemptId: f.attemptId, allocationId: f.allocationId, skuId: f.skuId,
    orderRevision: name === "first-settlement-inactive" ? 0 : order.revision,
    service: { id: f.serviceId, version: 1, termsHash: f.serviceHash }, feedback: { id: f.feedbackId, version: 1, termsHash: f.feedbackHash },
    withUnknownProvider: async body => body(), providerCounts: () => ({ posts: local.counts().posts, reads: local.counts().gets }),
    runRefundJob: id => runOriginalRefundJob(context, id), payment: { intent, binding: paymentBindings(), observation } };
}

export async function createOwnerAftercareRegistryFixture(context: ExecutorFixtureContext): Promise<AftercareRegistryFixture> {
  const local = aftercareLocalTransport();
  context.registerCleanup(installAftercareAdapters(local));
  const f = await createAftercareFixture(context, local), operator = await aftercareActor(context), lifecycleId = randomUUID(), holdId = randomUUID();
  const applicationId = "t61-registry-" + randomUUID();
  await context.admin.query("INSERT INTO treido.order_aftercare_operator_grants(user_id,capability,environment,application_id,approved_at,approval_reference) VALUES($1,'cases.read','test',$2,clock_timestamp(),'SYNTHETIC ISOLATED T61 ONLY')", [operator.userId, applicationId]);
  // This separate approval-shaped namespace has NO account lifecycle binding;
  // it cannot become an additional current reviewed closure authority.
  await context.admin.query("INSERT INTO treido.order_aftercare_lifecycle_policies(id,version,environment,application_id,preserves_accepted_evidence,legal_holds_reviewed,allow_restore_restriction,retention_description,approved_at,approval_reference) VALUES($1,'order-aftercare-v1','test',$2,true,true,false,$3::jsonb,clock_timestamp(),'SYNTHETIC ISOLATED T61 ONLY')", [lifecycleId, applicationId, JSON.stringify({ bg: "Синтетично", en: "Synthetic" })]);
  await context.admin.query("INSERT INTO treido.order_aftercare_legal_holds(id,user_id,environment,application_id,approved_at,approval_reference) VALUES($1,$2,'test',$3,clock_timestamp(),'SYNTHETIC ISOLATED T61 ONLY')", [holdId, f.buyer.userId, applicationId]);
  return { admin: context.admin, rows: { order_service_policies: f.serviceId, order_financial_policies: f.financialId,
    order_aftercare_operator_grants: { userId: operator.userId, capability: "cases.read", environment: "test", applicationId }, order_feedback_policies: f.feedbackId, order_aftercare_lifecycle_policies: lifecycleId, order_aftercare_legal_holds: holdId } };
}
