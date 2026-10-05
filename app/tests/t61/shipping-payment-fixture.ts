import { randomUUID } from "node:crypto";
import { inTransaction } from "../../apps/web/src/server/db/database";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import { financialPolicyHash, type FinancialPolicy } from "../../apps/web/src/features/order-aftercare/policy.server";
import { policyHash, bindingHash, rateHash } from "../../apps/web/src/features/order-shipping/registry.server";
import { shippingCosts, type PrepareShipping, type ShippingChoice, type TaxBasis } from "../../apps/web/src/features/order-shipping/model";
import type { ShippingPolicy, CarrierBinding, ShippingRate } from "../../apps/web/src/features/order-shipping/view";
import { shippingSource } from "../../apps/web/src/features/order-shipping/source.server";
import { readShippingContext, readShippingReview } from "../../apps/web/src/features/order-shipping/queries.server";
import { executeShippingCommand } from "../../apps/web/src/features/order-shipping/commands.server";
import { createPayableQuote } from "../../apps/web/src/features/payments/quotes.server";
import { feeMinor } from "../../apps/web/src/features/payments/model";
import { beginPayment } from "../../apps/web/src/features/payments/attempts.server";
import { processPaymentObservation } from "../../apps/web/src/features/payments/jobs.server";
import { changeOrderFulfilment } from "../../apps/web/src/features/order-aftercare/fulfilment.server";
import { prepareOrderRefund, executeOrderRefund } from "../../apps/web/src/features/order-aftercare/refund-commands.server";
import { readRefundIntent } from "../../apps/web/src/features/order-aftercare/refund-storage.server";
import { processOrderRefund } from "../../apps/web/src/features/order-aftercare/jobs.server";
import { executeJob, type ShippingEffectContext, type EffectResult } from "../../apps/web/src/server/jobs/execution.server";
import { enqueueJob, jobColumns, type JobRow } from "../../apps/web/src/server/jobs/outbox.server";
import { processUnboundShippingInput } from "../../apps/web/src/server/jobs/shipping-authority.server";
import { processAcceptedRecipientRetention } from "../../apps/web/src/features/order-aftercare/shipping-retention.server";
import type { SellerTransaction } from "../../apps/web/src/server/db/database";
import { aftercareNamespace, installAftercareAdapters, type AftercareNativeContext } from "./aftercare-fixture";
import { createShippingSourceFixture } from "./shipping-source-fixture";
import { shippingLocalTransport } from "./shipping-local-transport";
import type { ShippingFixtureEvidence } from "./shipping-qualification-fixture";

export type ShippingPaymentContext = AftercareNativeContext & { registerCleanup: (cleanup: () => void | Promise<void>) => void; qualificationEvidence: ShippingFixtureEvidence };
export type ShippingFixtureOptions = { missingPolicy?: boolean; missingRetention?: boolean;
  taxBasis?: TaxBasis; buyerFeeMinor?: number; pickupOnly?: boolean; shortTariff?: boolean };

/** Executable but UNREGISTERED/UNRUN while canonical interfaces move. Every
 * positive transition uses the ORIGINAL feature/SQL/executor pipeline. Registry
 * rows and injected SDK observations are explicitly synthetic owned fixtures,
 * not business/provider/legal approval. Missing real readiness is a hard failure.
 * No migration, helper function, private timestamp or accepted source is forged. */
export async function createShippingPaymentFixture(context: ShippingPaymentContext, kind: "cart" | "offer", options: ShippingFixtureOptions = {}) {
  const { database, admin } = context;
  const isolated = (await admin.query<{ name: string }>("SELECT current_database() AS name")).rows[0];
  if (isolated.name !== "t61_isolated") throw Error("Shipping fixtures require the original owned disposable native database");
  const helpers = (await database.pool.query<{ retention: boolean; quote: boolean }>(
    "SELECT to_regprocedure('treido.order_shipping_retention_ready(uuid,text,text)') IS NOT NULL AS retention,to_regprocedure('treido.order_shipping_quote_ready(uuid,text,text)') IS NOT NULL AS quote",
  )).rows[0];
  if (!helpers.retention || !helpers.quote) throw Error("Actual canonical shipping readiness registration missing; no stub or approval override permitted");
  const local = shippingLocalTransport();
  context.registerCleanup(installAftercareAdapters(local));
  context.recordAdapterCounters?.("original Stripe SDK through synthetic shipping local transport; external provider effects zero", local.counts);
  const f = await createShippingSourceFixture(context, kind, options.pickupOnly);
  const scope = { ...aftercareNamespace, platformAccount: "acct_T61Platform", livemode: false };
  const baseId = randomUUID(), financialId = randomUUID(), policyId = randomUUID(), carrierId = randomUUID(), rateId = randomUUID();
  const connected = "acct_T61" + randomUUID().replaceAll("-", "");
  const label = { bg: "Синтетичен локален тест", en: "Synthetic owned local test" };
  await admin.query("INSERT INTO treido.payment_policies(id,platform_account,livemode,environment,application_id,currency,fee_bps,fee_fixed_minor,tax_policy,handover,settlement_merchant,refund_policy,buyer_terms,approval_reference,approved_at) VALUES($1,$2,false,'test',$3,'EUR',100,0,'inclusive','pickup','seller','full_fee_and_transfer_reversal',$4::jsonb,'SYNTHETIC OWNED T61 SHIPPING ONLY',clock_timestamp())", [baseId, scope.platformAccount, scope.applicationId, JSON.stringify(label)]);
  await admin.query("INSERT INTO treido.seller_payment_bindings(id,seller_id,platform_account,livemode,connected_account,approval_reference,approved_at) VALUES($1,$2,$3,false,$4,'SYNTHETIC OWNED T61 SHIPPING ONLY',clock_timestamp())", [randomUUID(), f.sellerId, scope.platformAccount, connected]);
  await admin.query("INSERT INTO treido.payable_listing_terms(seller_id,listing_id,publication_revision,policy_id,approval_reference,approved_at) VALUES($1,$2,$3,$4,'SYNTHETIC OWNED T61 SHIPPING ONLY',clock_timestamp())", [f.sellerId, f.line.listingId, f.line.publicationRevision, baseId]);
  const financial: Omit<FinancialPolicy, "id" | "termsHash"> = { version: 1, purpose: "goods_aftercare_v2", method: "shipping",
    refundContract: "bounded_partial_v2", terms: label, executionSeconds: 600, refundRequestLimit: 12,
    taxBasis: "inclusive_unspecified", feeBasis: "original_proportional_provider_reversal", reverseTransfer: true,
    refundApplicationFee: true, trackingAllowed: true, recipientRetentionDescription: label };
  const financialHash = financialPolicyHash(financial);
  await admin.query("INSERT INTO treido.order_financial_policies(id,base_policy_id,version,purpose,method,refund_contract,terms,terms_hash,execution_seconds,refund_request_limit,tax_basis,fee_basis,reverse_transfer,refund_application_fee,tracking_allowed,recipient_retention_description,platform_account,livemode,environment,application_id,approved_at,approval_reference) VALUES($1,$2,1,'goods_aftercare_v2','shipping','bounded_partial_v2',$3::jsonb,$4,600,12,'inclusive_unspecified','original_proportional_provider_reversal',true,true,true,$5::jsonb,$6,false,'test',$7,clock_timestamp(),'SYNTHETIC OWNED T61 SHIPPING ONLY')", [financialId, baseId, JSON.stringify(label), financialHash, JSON.stringify(label), scope.platformAccount, scope.applicationId]);
  const policy: Omit<ShippingPolicy, "id" | "termsHash"> = { version: 1, basePolicyId: baseId, financialPolicyId: financialId, ...scope,
    countries: ["BG"], fields: ["name", "phone", "address", "city", "postalCode"], requiredFields: ["name", "phone", "address", "city"],
    recipientPurpose: label, retentionDescription: label, terms: label, rights: label, refundTerms: label, taxDescription: label,
    taxBasis: options.taxBasis ?? "inclusive_unspecified", shippingRefund: { beforeDispatch: "refundable", afterDispatch: "not_refundable", return: "not_refundable" },
    commissionBasis: "merchandise", quoteValidity: "original_allocation_within_tariff", reviewSeconds: 60,
    unacceptedRecipientSeconds: 60, acceptedRecipientSeconds: 60, retentionVersion: "order-shipping-v1" };
  const policyDigest = policyHash(policy);
  const supply = options.pickupOnly ? null : await inTransaction(database, tx => shippingSource(tx, f.buyer.identity, f.source));
  const merchandise = f.line.quantity * f.line.unitPriceMinor;
  const carrier: Omit<CarrierBinding, "id" | "bindingHash"> = { policyId, sellerId: f.sellerId, version: 1,
    country: "BG", method: "address", carrierCode: "synthetic-t61", carrierLabel: label, officeCodes: null, sourceKind: "approved_seller_tariff" };
  const validUntil = (await admin.query<{ date: Date }>("SELECT clock_timestamp()+make_interval(secs=>$1) AS date", [options.shortTariff ? 120 : 86400])).rows[0].date.toISOString();
  const rate: Omit<ShippingRate, "id" | "rateHash"> = { bindingId: carrierId, version: 1, shippingMinor: 700,
    buyerFeeMinor: options.buyerFeeMinor ?? 0, taxMinor: policy.taxBasis === "inclusive_unspecified" ? null : 50,
    taxBasis: policy.taxBasis, maximumUnits: 3, maximumMerchandiseMinor: 50000, validUntil,
    sourceReference: "SYNTHETIC OWNED T61 TARIFF ONLY", sourceHash: policy.taxBasis === "inclusive_unspecified" ? null : supply?.sourceHash ?? inputHash(f.source),
    merchandiseMinor: policy.taxBasis === "inclusive_unspecified" ? null : merchandise };
  if (!options.missingPolicy) {
    await admin.query("INSERT INTO treido.order_shipping_policies(id,version,base_policy_id,financial_policy_id,platform_account,livemode,environment,application_id,payload,terms_hash,approved_at,approval_reference) VALUES($1,1,$2,$3,$4,false,'test',$5,$6::jsonb,$7,clock_timestamp(),'SYNTHETIC OWNED T61 SHIPPING ONLY')", [policyId, baseId, financialId, scope.platformAccount, scope.applicationId, JSON.stringify(policy), policyDigest]);
    await admin.query("INSERT INTO treido.order_shipping_carriers(id,policy_id,seller_id,version,payload,binding_hash,approved_at,approval_reference) VALUES($1,$2,$3,1,$4::jsonb,$5,clock_timestamp(),'SYNTHETIC OWNED T61 SHIPPING ONLY')", [carrierId, policyId, f.sellerId, JSON.stringify(carrier), bindingHash(carrier)]);
    await admin.query("INSERT INTO treido.order_shipping_rates(id,policy_id,carrier_binding_id,version,payload,rate_hash,valid_until,approved_at,approval_reference) VALUES($1,$2,$3,1,$4::jsonb,$5,$6,clock_timestamp(),'SYNTHETIC OWNED T61 SHIPPING ONLY')", [rateId, policyId, carrierId, JSON.stringify(rate), rateHash(rate), validUntil]);
  }
  if (!options.missingPolicy && !options.missingRetention) {
    // Exact observed native retention contract. Future canonical version/namespace
    // differences fail visibly; never patch a function to return ready.
    await admin.query("INSERT INTO treido.order_aftercare_lifecycle_policies(id,version,environment,application_id,preserves_accepted_evidence,legal_holds_reviewed,allow_restore_restriction,retention_description,approved_at,approval_reference) VALUES($1,'order-aftercare-shipping-v2','test','app_T61Native',true,true,true,$2::jsonb,clock_timestamp(),'SYNTHETIC OWNED T61 SHIPPING ONLY') ON CONFLICT(environment,application_id,version) DO NOTHING", [randomUUID(), JSON.stringify(label)]);
    const currentBinding = (await admin.query("SELECT id FROM treido.account_lifecycle_bindings WHERE environment='test' AND application_id='app_T61Native' AND clerk_instance_id='app_T61Native' AND clerk_mode='test' AND aftercare_lifecycle_version='order-aftercare-shipping-v2' AND closure_enabled AND approved_at<=clock_timestamp() AND revoked_at IS NULL")).rows[0];
    if (!currentBinding) await admin.query("INSERT INTO treido.account_lifecycle_bindings(id,environment,application_id,clerk_instance_id,clerk_mode,assistant_lifecycle_version,aftercare_lifecycle_version,stripe_account,stripe_livemode,stripe_application_id,security_enabled,closure_enabled,approved_at) VALUES($1,'test','app_T61Native','app_T61Native','test','assistant-input-v1','order-aftercare-shipping-v2',$2,false,$3,true,true,clock_timestamp())", [randomUUID(), scope.platformAccount, scope.applicationId]);
    await admin.query("INSERT INTO treido.order_shipping_retention_approvals(id,policy_id,policy_hash,version,platform_account,livemode,environment,application_id,executor_application_id,executor_environment,clerk_instance_id,clerk_mode,aftercare_lifecycle_version,deletes_due_unbound,deletes_due_accepted,preserves_accepted_history,requires_zero_obligations,legal_holds_reviewed,approved_at,approval_reference) VALUES($1,$2,$3,'order-shipping-retention-v1',$4,false,'test',$5,$5,'test','app_T61Native','test','order-aftercare-shipping-v2',true,true,true,true,true,clock_timestamp(),'SYNTHETIC OWNED T61 SHIPPING ONLY')", [randomUUID(), policyId, policyDigest, scope.platformAccount, scope.applicationId]);
  }
  if (!options.missingPolicy && !options.missingRetention) {
    const q = context.qualificationEvidence;
    if (q.scope !== "ISOLATED_CANONICAL_SQL_GRANTS_DENIAL_PREFLIGHT_ONLY") throw Error("Actual bounded native qualification evidence mandatory");
    await admin.query(`INSERT INTO treido.order_shipping_integration_qualifications(id,policy_id,policy_hash,version,canonical_ledger_hash,source_manifest_hash,native_receipt_hash,compiler_receipt_hash,registered_kinds,quote_components_reviewed,refund_components_reviewed,signed_expiry_reviewed,closure_aggregation_reviewed,audit_result,audit_review_reference,approved_at,approval_reference)
      VALUES($1,$2,$3,'original-shipping-integration-v1',$4,$5,$6,$7,'["shipping.input-expiry","shipping.recipient-expiry"]'::jsonb,true,true,true,true,$8,$9,clock_timestamp(),'SYNTHETIC T61 DISPOSABLE ONLY; PREFLIGHT IS NOT POSITIVE JOURNEY OR LAUNCH APPROVAL')`,
    [randomUUID(), policyId, policyDigest, q.canonicalLedgerHash, q.sourceManifestHash, q.nativeReceiptHash, q.compilerReceiptHash,
      q.auditPassed ? "passed" : "owner_accepted", "SYNTHETIC TEST ONLY; actual audit " + (q.auditPassed ? "PASS" : "FAIL") + " receipt:" + q.auditReceiptHash]);
  }
  const costs = shippingCosts({ merchandiseMinor: merchandise, shippingMinor: rate.shippingMinor, buyerFeeMinor: rate.buyerFeeMinor,
    taxMinor: rate.taxMinor, taxBasis: rate.taxBasis, applicationFeeMinor: feeMinor(merchandise, 100, 0) });
  // Deterministic original input hash is used only for unavailable negative
  // commands. Positive preparation reads its option from the real runtime gate.
  const command: PrepareShipping = { action: "prepare", actorKey: libraryActorKey(f.buyer.identity), requestId: randomUUID(), source: f.source,
    language: "en", sourceHash: supply?.sourceHash ?? inputHash(f.source), policyId, rateId,
    optionHash: inputHash({ format: "shipping-option-v1", policyId, policyHash: policyDigest, financialId, financialHash,
      carrierId, carrierHash: bindingHash(carrier), rateId, rateHash: rateHash(rate), costs }), country: "BG",
    recipient: { name: "T61 PRIVATE NAME", phone: "+359000000001", address: "T61 PRIVATE ADDRESS", city: "T61 PRIVATE CITY", postalCode: "1000" }, acknowledgedPurpose: true };
  const prepare = async (requestId = command.requestId) => {
    const actual = await readShippingContext(database, f.buyer.identity, f.source, "en");
    const option = actual.options.find(option => option.policy.id === policyId && option.rate.id === rateId);
    if (!actual.available || !option || actual.sourceHash !== command.sourceHash) throw Error("Original current shipping readiness/option unavailable; returned native contract finding, never fallback");
    const request = { ...command, requestId, optionHash: option.optionHash };
    const acknowledgment = await executeShippingCommand(database, f.buyer.identity, request);
    const review = await readShippingReview(database, f.buyer.identity, acknowledgment.id);
    return { request, review, choice: { id: review.id, revision: review.revision, snapshotHash: review.snapshotHash, acknowledged: true } satisfies ShippingChoice };
  };
  const accept = async (prepared: Awaited<ReturnType<typeof prepare>>) => {
    await executeShippingCommand(database, f.buyer.identity, { action: "accept", actorKey: command.actorKey, requestId: randomUUID(), choice: prepared.choice });
    const review = await readShippingReview(database, f.buyer.identity, prepared.review.id);
    return { ...prepared, review, choice: { ...prepared.choice, revision: review.revision } };
  };
  const quoteCommand = (choice: ShippingChoice) => ({ actorKey: command.actorKey, requestId: randomUUID(), language: "en" as const,
    handover: "shipping" as const, policyId: baseId, source: f.source, shipping: choice,
    aftercare: { policyId: financialId, version: 1, termsHash: financialHash, acknowledged: true as const } });
  const createQuote = async (choice: ShippingChoice) => {
    const request = quoteCommand(choice), result = await createPayableQuote(database, f.buyer.identity, request);
    return { request, id: result.id };
  };
  const runPaymentObservation = async (attemptId: string) => {
    const job = (await admin.query<JobRow>(`SELECT ${jobColumns} FROM treido.outbox_jobs WHERE kind='payment.reconcile' AND resource_id=$1 AND state IN('pending','accepted','completed') ORDER BY created_at LIMIT 1`, [attemptId])).rows[0];
    if (!job || job.kind !== "payment.reconcile") throw Error("Original payment command did not create its actual observation job");
    return executeJob(database, { jobId: job.id, sellerId: job.sellerId, generation: job.generation, schemaVersion: 1, ...aftercareNamespace }, aftercareNamespace, randomUUID(), { "payment.reconcile": ctx => processPaymentObservation(database, ctx) });
  };
  const pay = async (quoteId: string) => {
    const result = await beginPayment(database, f.buyer.identity, { actorKey: command.actorKey, requestId: randomUUID(), id: quoteId });
    await runPaymentObservation(result.id);
    const order = (await admin.query<{ id: string; revision: number; payment_state: string; fulfilment_state: string; settlement_state: string }>("SELECT id,revision,payment_state,fulfilment_state,settlement_state FROM treido.paid_orders WHERE attempt_id=$1 AND quote_id=$2", [result.id, quoteId])).rows[0];
    if (!order || order.payment_state !== "paid" || order.settlement_state !== "transferred" || order.fulfilment_state !== "pending") throw Error("Original payment observation did not create authoritative local shipping paid order");
    return { orderId: order.id, attemptId: result.id, revision: order.revision };
  };
  const fulfil = async (orderId: string, inspectReported?: (reported: Awaited<ReturnType<typeof changeOrderFulfilment>>) => Promise<void>) => {
    const reported = await changeOrderFulfilment(database, f.merchant.identity, { action: "record_tracking", actorKey: libraryActorKey(f.merchant.identity), sellerId: f.sellerId,
      orderId, requestId: randomUUID(), expectedRevision: 0, language: "en", carrier: carrier.carrierCode, trackingReference: "T61-LOCAL-ONLY", description: "Synthetic dispatch report" });
    if (inspectReported) await inspectReported(reported);
    return changeOrderFulfilment(database, f.buyer.identity, { action: "confirm_delivery", actorKey: command.actorKey, sellerId: null,
      orderId, requestId: randomUUID(), expectedRevision: reported.revision, language: "en", description: "Synthetic original buyer confirmation" });
  };
  const refund = async (orderId: string, shipping: boolean, remaining = true, expectedRevision = 0) => prepareOrderRefund(database, f.merchant.identity, {
    action: "prepare_refund", actorKey: libraryActorKey(f.merchant.identity), sellerId: f.sellerId, orderId,
    requestId: randomUUID(), expectedRevision, language: "en", caseId: null, reason: "Synthetic original local refund",
    selection: remaining ? "remaining" : "lines", lines: [], shipping,
  });
  const emitRefund = async (orderId: string, intentId: string, expectedRevision: number) => executeOrderRefund(database, f.merchant.identity, {
    action: "execute_refund", actorKey: libraryActorKey(f.merchant.identity), sellerId: f.sellerId, orderId, requestId: randomUUID(), expectedRevision, language: "en", intentId,
  });
  const reconcileRefund = async (intentId: string) => {
    const row = await inTransaction(database, tx => readRefundIntent(tx, intentId));
    if (!row || row.firstAttemptAt === null) throw Error("No original emitted refund to reconcile");
    local.succeed(row);
    const job = (await admin.query<JobRow>(`SELECT ${jobColumns} FROM treido.outbox_jobs WHERE kind='payment.aftercare' AND resource_id=$1 AND state IN('pending','accepted') ORDER BY created_at LIMIT 1`, [intentId])).rows[0];
    if (!job || job.kind !== "payment.aftercare") throw Error("Missing original refund observation job");
    return executeJob(database, { jobId: job.id, sellerId: job.sellerId, generation: job.generation, schemaVersion: 1, ...aftercareNamespace }, aftercareNamespace, randomUUID(), { "payment.aftercare": ctx => processOrderRefund(database, ctx) });
  };
  const runFinite = async (choiceId: string, kind: "shipping.input-expiry" | "shipping.recipient-expiry", inspect?: (job: ShippingEffectContext, tx: SellerTransaction) => Promise<void>, rollbackFault?: Error) => {
    const due = (await database.pool.query<{ due: Date }>("SELECT r.retain_until AS due FROM treido.order_shipping_recipients r WHERE r.choice_id=$1 AND r.buyer_id=$2", [choiceId, f.buyer.userId])).rows[0];
    if (!due) throw Error("No actual original finite retention target");
    const delay = Math.max(0, due.due.getTime() - Date.now() + 250);
    if (delay > 65000) throw Error("Original retention deadline exceeds this bounded fixture; timestamp is preserved");
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const intent = { kind, authority: "shipping" as const, buyerId: f.buyer.userId, sellerId: null, actorId: null, resourceId: choiceId, operationKey: choiceId };
    // The actual canonical guard validates and records the original intent and
    // effect row. External signed delivery remains unqualified; this local run
    // uses the original event parser/executor. No admin job or fabricated lease.
    const id = await inTransaction(database, tx => enqueueJob(tx, intent));
    const job = (await database.pool.query<JobRow>(`SELECT ${jobColumns} FROM treido.outbox_jobs WHERE id=$1`, [id])).rows[0];
    if (!job || job.kind !== kind || job.sellerId !== null || job.buyerId !== f.buyer.userId) throw Error("Wrong original finite shipping job");
    const wrap = (ctx: ShippingEffectContext, result: EffectResult): EffectResult => ({ ...result,
      apply: async tx => { if (inspect) await inspect(ctx, tx); if (!result.apply) throw Error("Original processor omitted actual local apply"); await result.apply(tx); if (rollbackFault) throw rollbackFault; } });
    return executeJob(database, { jobId: job.id, sellerId: null, buyerId: job.buyerId, generation: job.generation, schemaVersion: 1, ...aftercareNamespace }, aftercareNamespace, randomUUID(), {
      "shipping.input-expiry": async ctx => wrap(ctx, await processUnboundShippingInput(database, ctx)),
      "shipping.recipient-expiry": async ctx => wrap(ctx, await processAcceptedRecipientRetention(database, ctx)),
    });
  };
  const revokePolicy = () => admin.query("UPDATE treido.order_shipping_policies SET revoked_at=clock_timestamp() WHERE id=$1 AND revoked_at IS NULL", [policyId]);
  return { ...f, local, scope, baseId, financialId, financialHash, policyId, carrierId, rateId, policy, rate, connected,
    command, prepare, accept, quoteCommand, createQuote, pay, runPaymentObservation, fulfil, refund, emitRefund, reconcileRefund, runFinite, revokePolicy };
}

/** Concrete factory for the existing single runtime-grant definition. Both
 * original private inputs are prepared before the paid quote consumes stock. */
export async function createShippingRuntimeObligationFixture(context: ShippingPaymentContext) {
  const f = await createShippingPaymentFixture(context, "cart");
  const first = await f.prepare(), second = await f.prepare(randomUUID());
  const input = await f.accept(first), quote = await f.createQuote(input.choice);
  await f.pay(quote.id);
  return { database: f.database, buyerId: f.buyer.userId, boundChoiceId: input.choice.id, unboundChoiceId: second.choice.id };
}
