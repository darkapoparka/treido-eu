import { vi } from "vitest";
import { randomUUID } from "node:crypto";
import Stripe from "../../apps/web/node_modules/stripe/esm/stripe.esm.node.js";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import type { BackendBindings } from "../../apps/web/src/server/config/backend-bindings";
import * as backend from "../../apps/web/src/server/config/backend-bindings.server";
import * as jobs from "../../apps/web/src/server/jobs/config.server";
import * as payment from "../../apps/web/src/features/payments/bindings.server";
import * as refundProvider from "../../apps/web/src/features/order-aftercare/refund-provider.server";
import { authorizeHuman, inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { createPublicationFixture } from "../../apps/web/tests/fixtures/publication-flow";
import { changeInventory } from "../../apps/web/src/features/inventory/commands.server";
import { publishListing } from "../../apps/web/src/features/selling/publish.server";
import { settleAllocation } from "../../apps/web/src/features/inventory/allocations.server";
import { changeBuyerCart } from "../../apps/web/src/features/buyer-cart/cart.server";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import { createPayableQuote } from "../../apps/web/src/features/payments/quotes.server";
import { financialPolicyHash, servicePolicyHash, type FinancialPolicy, type ServicePolicy } from "../../apps/web/src/features/order-aftercare/policy.server";
import { feedbackPolicyHash, type FeedbackPolicy } from "../../apps/web/src/features/order-feedback/storage.server";
import type { RefundIntent } from "../../apps/web/src/features/order-aftercare/refund-storage.server";

export type AftercareNativeContext = { database: SellerDatabase; admin: Pool; registerRecent: (identity: VerifiedIdentity) => void;
  recordAdapterCounters?: (label: string, read: () => Record<string, number>) => void };
export const aftercareNamespace = { environment: "test", applicationId: "treido-t61-isolated" };
/** Synthetic test target metadata only. No key-shaped environment value or
 * credential is installed and this bypass adapter is NOT provider qualification. */
const binding: payment.PaymentBindings = { ...aftercareNamespace, platformAccount: "acct_T61Platform", livemode: false,
  origin: "http://127.0.0.1", publishableKey: "SYNTHETIC-LOCAL-ONLY", collectionEnabled: true };
const backendBinding: BackendBindings = { environment: "test", application: { origin: binding.origin, region: "isolated-test" },
  identity: { provider: "clerk", applicationId: "app_T61Native", mode: "test" },
  database: { provider: "neon", projectId: "synthetic-t61", branchId: "synthetic-t61", purpose: "test", region: "isolated-test",
    databaseName: "treido_t61", runtimeRole: "treido_runtime", loginRole: "treido_runtime", localBridge: false } };
export function aftercareLocalTransport() {
  const charges = new Map<string, { id: string; paymentIntentId: string; connected: string; total: number; fee: number; refunded: number; feeRefunded: number; disputed?: boolean }>();
  const intents = new Map<string, Record<string, unknown>>();
  const refunds = new Map<string, Record<string, unknown>>(), reversals = new Map<string, Record<string, unknown>>();
  let posts = 0, gets = 0;
  // Actual installed Stripe SDK through its explicit local transport seam. All
  // provider-shaped responses are synthetic; every unexpected request fails.
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "api.stripe.com") throw Error("Unexpected synthetic provider host");
    const method = init?.method ?? "GET";
    if (method === "POST") {
      if (url.pathname !== "/v1/refunds") throw Error("Unexpected provider POST");
      posts++; throw Error("SYNTHETIC refund acknowledgment lost after emission");
    }
    if (method !== "GET") throw Error("Unexpected provider mutation");
    gets++;
    let result: unknown;
    if (url.pathname.startsWith("/v1/accounts/")) result = { id: url.pathname.split("/").at(-1), object: "account", country: "BG", default_currency: "eur", charges_enabled: true, payouts_enabled: true,
      details_submitted: true, capabilities: { transfers: "active", card_payments: "active" }, requirements: { currently_due: [], past_due: [], pending_verification: [], disabled_reason: null } };
    else if (url.pathname.startsWith("/v1/payment_intents/")) result = intents.get(url.pathname.split("/").at(-1)!);
    else if (url.pathname.startsWith("/v1/charges/")) {
      const row = charges.get(url.pathname.split("/").at(-1)!); if (!row) throw Error("Unknown original synthetic charge");
      result = { id: row.id, object: "charge", livemode: false, currency: "eur", amount: row.total, amount_refunded: row.refunded,
        paid: true, captured: true, disputed: row.disputed ?? false, payment_intent: row.paymentIntentId, transfer_data: { destination: row.connected },
        balance_transaction: { id: "bt_" + row.id, object: "balance_transaction", fee: 123, currency: "eur" },
        transfer: { id: "tr_" + row.id, object: "transfer", livemode: false, currency: "eur", amount: row.total,
          destination: row.connected, source_transaction: row.id, amount_reversed: row.refunded, reversed: row.refunded === row.total },
        application_fee: { id: "fee_" + row.id, object: "application_fee", livemode: false, currency: "eur", charge: row.id, amount: row.fee, amount_refunded: row.feeRefunded } };
    } else if (url.pathname === "/v1/refunds") result = { object: "list", data: [...refunds.values()].filter(row => row.payment_intent === url.searchParams.get("payment_intent")), has_more: false };
    else if (url.pathname.startsWith("/v1/refunds/")) result = refunds.get(url.pathname.split("/").at(-1)!);
    else if (url.pathname.startsWith("/v1/transfers/")) {
      const parts = url.pathname.split("/"), transferId = parts[3];
      const row = charges.get(transferId.replace(/^tr_/, "")); if (!row) throw Error("Unknown original transfer");
      result = parts[4] === "reversals" ? reversals.get(parts[5])
        : { id: transferId, object: "transfer", livemode: false, currency: "eur", amount: row.total, destination: row.connected, source_transaction: row.id };
    } else if (url.pathname.startsWith("/v1/application_fees/")) {
      const parts = url.pathname.split("/"), row = charges.get(parts[3].replace(/^fee_/, "")); if (!row) throw Error("Unknown original fee");
      result = parts[4] === "refunds" ? { object: "list", data: [{ id: "fr_" + row.id, amount: row.feeRefunded }], has_more: false }
        : { id: parts[3], object: "application_fee", livemode: false, currency: "eur", charge: row.id, amount: row.fee, amount_refunded: row.feeRefunded };
    }
    else throw Error("Unexpected provider GET");
    if (!result) throw Error("Unknown exact synthetic provider object");
    return Response.json(result, { headers: { "request-id": "req_T61Synthetic", "stripe-version": "2026-09-30.endive" } });
  };
  const stripe = new Stripe("SYNTHETIC-LOCAL-TRANSPORT-ONLY", { apiVersion: "2026-09-30.endive", maxNetworkRetries: 0, httpClient: Stripe.createFetchHttpClient(transport) });
  const succeed = (row: RefundIntent) => {
    const charge = charges.get(row.chargeId); if (!charge) throw Error("Unknown frozen original charge");
    const id = "re_T61" + row.id.replaceAll("-", ""), reversalId = "trr_T61" + row.id.replaceAll("-", "");
    if (refunds.has(id)) throw Error("Synthetic observation already provided");
    charge.refunded += row.amountMinor; charge.feeRefunded += row.feeMinor;
    refunds.set(id, { id, object: "refund", status: "succeeded", payment_intent: row.paymentIntentId, charge: row.chargeId,
      currency: "eur", amount: row.amountMinor, metadata: row.parameters.metadata, transfer_reversal: reversalId });
    reversals.set(reversalId, { id: reversalId, object: "transfer_reversal", currency: "eur", amount: row.amountMinor, source_refund: id });
  };
  return { stripe, charges, intents, succeed, counts: () => ({ posts, gets }) };
}
export function installAftercareAdapters(local: ReturnType<typeof aftercareLocalTransport>) {
  const target = vi.spyOn(backend, "requireBackendBindings").mockReturnValue(backendBinding);
  const job = vi.spyOn(jobs, "requireJobBindings").mockReturnValue({ ...aftercareNamespace, origin: binding.origin, repairServiceId: "t61-isolated" });
  const collection = vi.spyOn(payment, "requireCollection").mockReturnValue(binding);
  const paymentTarget = vi.spyOn(payment, "paymentBindings").mockReturnValue(binding);
  const stripe = vi.spyOn(payment, "verifiedStripe").mockResolvedValue(local.stripe);
  const available = vi.spyOn(refundProvider, "orderRefundProviderAvailable").mockReturnValue(true);
  const adapter = vi.spyOn(refundProvider, "orderRefundProvider").mockResolvedValue({ binding, stripe: local.stripe });
  return () => { adapter.mockRestore(); available.mockRestore(); stripe.mockRestore(); paymentTarget.mockRestore(); collection.mockRestore(); job.mockRestore(); target.mockRestore(); };
}
export async function withAftercareAdapters<T>(local: ReturnType<typeof aftercareLocalTransport>, body: () => Promise<T>): Promise<T> {
  const restore = installAftercareAdapters(local);
  try { return await body(); } finally { restore(); }
}
export async function aftercareActor(context: AftercareNativeContext) {
  const identity: VerifiedIdentity = { subject: "user_t61_order_" + randomUUID().replaceAll("-", "") };
  context.registerRecent(identity);
  const user = await inTransaction(context.database, tx => authorizeHuman(tx, identity, true));
  return { identity, userId: user.id };
}
/** Original publish/inventory/cart/quote/accepted-aftercare commands. Only prior
 * paid provider evidence/order are seeded as explicit native fixtures, never
 * successful real payments or a relaxation of runtime/provider qualification. */
export async function createAftercareFixture(context: AftercareNativeContext, local: ReturnType<typeof aftercareLocalTransport>, options: {
  chargeEvidence?: boolean; paidEvidence?: boolean; acceptAftercare?: boolean; sellerKind?: "personal" | "business";
  buyer?: Awaited<ReturnType<typeof aftercareActor>>; merchant?: Awaited<ReturnType<typeof aftercareActor>>;
} = {}) {
  context.recordAdapterCounters?.("original Stripe SDK / injected synthetic local transport", local.counts);
  const merchant = options.merchant ?? await aftercareActor(context), buyer = options.buyer ?? await aftercareActor(context), client = await context.admin.connect();
  let published: Awaited<ReturnType<typeof createPublicationFixture>>;
  try { published = await createPublicationFixture({ database: context.database, admin: client, owner: merchant.identity }, options.sellerKind ?? "business"); }
  finally { client.release(); }
  const stock = await changeInventory(context.database, merchant.identity, { sellerId: published.sellerId, listingId: published.draft.id, requestId: randomUUID(), expectedRevision: 0,
    operation: { kind: "setup", mode: options.sellerKind === "personal" ? "unique" : "stocked", onHand: options.sellerKind === "personal" ? 1 : 10, sellerSku: "T61-aftercare-original" } });
  const publication = await publishListing(context.database, merchant.identity, { ...published.input, expectedRevision: stock.listingRevision });
  const policyId = randomUUID(), mappingId = randomUUID(), financialId = randomUUID(), serviceId = randomUUID(), feedbackId = randomUUID();
  const connected = "acct_T61" + randomUUID().replaceAll("-", "");
  await context.admin.query("INSERT INTO treido.payment_policies(id,platform_account,livemode,environment,application_id,currency,fee_bps,fee_fixed_minor,tax_policy,handover,settlement_merchant,refund_policy,buyer_terms,approval_reference,approved_at) VALUES($1,$2,false,'test',$3,'EUR',100,0,'inclusive','pickup','seller','full_fee_and_transfer_reversal',$4::jsonb,'SYNTHETIC OWNED TEST ONLY',clock_timestamp())", [policyId, binding.platformAccount, binding.applicationId, JSON.stringify({ bg: "Синтетични условия", en: "Synthetic original terms" })]);
  await context.admin.query("INSERT INTO treido.seller_payment_bindings(id,seller_id,platform_account,livemode,connected_account,approval_reference,approved_at) VALUES($1,$2,$3,false,$4,'SYNTHETIC OWNED TEST ONLY',clock_timestamp())", [mappingId, published.sellerId, binding.platformAccount, connected]);
  await context.admin.query("INSERT INTO treido.payable_listing_terms(seller_id,listing_id,publication_revision,policy_id,approval_reference,approved_at) VALUES($1,$2,$3,$4,'SYNTHETIC OWNED TEST ONLY',clock_timestamp())", [published.sellerId, published.draft.id, publication.revision, policyId]);
  const financial: Omit<FinancialPolicy, "id" | "termsHash"> = { version: 1, purpose: "goods_aftercare_v2", method: "pickup", refundContract: "bounded_partial_v2",
    terms: { bg: "Синтетични частични възстановявания", en: "Synthetic bounded partial refunds" }, executionSeconds: 600, refundRequestLimit: 12, taxBasis: "inclusive_unspecified",
    feeBasis: "original_proportional_provider_reversal", reverseTransfer: true, refundApplicationFee: true, trackingAllowed: false,
    recipientRetentionDescription: { bg: "Синтетично", en: "Synthetic" } };
  const financialHash = financialPolicyHash(financial);
  await context.admin.query("INSERT INTO treido.order_financial_policies(id,base_policy_id,version,purpose,method,refund_contract,terms,terms_hash,execution_seconds,refund_request_limit,tax_basis,fee_basis,reverse_transfer,refund_application_fee,tracking_allowed,recipient_retention_description,platform_account,livemode,environment,application_id,approved_at,approval_reference) VALUES($1,$2,1,'goods_aftercare_v2','pickup','bounded_partial_v2',$3::jsonb,$4,600,12,'inclusive_unspecified','original_proportional_provider_reversal',true,true,false,$5::jsonb,$6,false,'test',$7,clock_timestamp(),'SYNTHETIC OWNED TEST ONLY')",
    [financialId, policyId, JSON.stringify(financial.terms), financialHash, JSON.stringify(financial.recipientRetentionDescription), binding.platformAccount, binding.applicationId]);
  const service: Omit<ServicePolicy, "id" | "termsHash"> = { version: 1, terms: { bg: "Синтетична помощ", en: "Synthetic support" }, retentionDescription: { bg: "Синтетично", en: "Synthetic" }, caseLimit: 5, eventLimit: 100, appealSeconds: 600 };
  const serviceHash = servicePolicyHash(service);
  await context.admin.query("INSERT INTO treido.order_service_policies(id,base_policy_id,version,terms,terms_hash,retention_description,case_limit,event_limit,appeal_seconds,platform_account,livemode,environment,application_id,approved_at,approval_reference) VALUES($1,$2,1,$3::jsonb,$4,$5::jsonb,5,100,600,$6,false,'test',$7,clock_timestamp(),'SYNTHETIC OWNED TEST ONLY')",
    [serviceId, policyId, JSON.stringify(service.terms), serviceHash, JSON.stringify(service.retentionDescription), binding.platformAccount, binding.applicationId]);
  const feedback: Omit<FeedbackPolicy, "id" | "termsHash"> = { version: 1, terms: { bg: "Синтетичен отзив", en: "Synthetic review" }, retentionDescription: { bg: "Синтетично", en: "Synthetic" }, eligibility: "completed_paid_no_refund", moderation: "explicit_approved_operator" };
  const feedbackHash = feedbackPolicyHash(feedback);
  await context.admin.query("INSERT INTO treido.order_feedback_policies(id,base_policy_id,version,eligibility,moderation,terms,terms_hash,retention_description,platform_account,livemode,environment,application_id,approved_at,approval_reference) VALUES($1,$2,1,'completed_paid_no_refund','explicit_approved_operator',$3::jsonb,$4,$5::jsonb,$6,false,'test',$7,clock_timestamp(),'SYNTHETIC OWNED TEST ONLY')",
    [feedbackId, policyId, JSON.stringify(feedback.terms), feedbackHash, JSON.stringify(feedback.retentionDescription), binding.platformAccount, binding.applicationId]);
  const cart = await changeBuyerCart(context.database, buyer.identity, { actorKey: libraryActorKey(buyer.identity), requestId: randomUUID(), expectedRevision: 0,
    operation: { kind: "add", listingId: published.draft.id, skuId: stock.skuId, publicationRevision: publication.revision, quantity: options.sellerKind === "personal" ? 1 : 3 } });
  const quote = await createPayableQuote(context.database, buyer.identity, { actorKey: libraryActorKey(buyer.identity), requestId: randomUUID(), language: "en", handover: "pickup", policyId,
    source: { kind: "cart", sellerId: published.sellerId, cartRevision: cart.revision },
    ...(options.acceptAftercare === false ? {} : { aftercare: { policyId: financialId, version: 1, termsHash: financialHash, acknowledged: true } }) });
  const q = (await context.admin.query<{ allocation_id: string; total_minor: number; application_fee_minor: number }>("SELECT allocation_id,total_minor,application_fee_minor FROM treido.payable_quotes WHERE id=$1", [quote.id])).rows[0];
  const attemptId = randomUUID(), orderId = randomUUID(), chargeId = "ch_T61" + orderId.replaceAll("-", ""), paymentIntentId = "pi_T61" + orderId.replaceAll("-", "");
  const parameters = { amount: q.total_minor, currency: "eur", application_fee_amount: q.application_fee_minor, transfer_data: { destination: connected },
    metadata: { quote_id: quote.id, seller_id: published.sellerId, application_id: binding.applicationId, environment: binding.environment } };
  await context.admin.query("INSERT INTO treido.payment_attempts(id,quote_id,seller_id,platform_account,livemode,operation_key,api_version,parameters,parameter_hash,state,provider_id,cancel_key) VALUES($1,$2,$3,$4,false,$5,'2026-09-30.endive',$6::jsonb,$7,$10,$8,$9)",
    [attemptId, quote.id, published.sellerId, binding.platformAccount, "t61-synthetic-paid:" + attemptId, JSON.stringify(parameters), inputHash(parameters), paymentIntentId, "t61-synthetic-cancel:" + attemptId, options.paidEvidence === false ? "processing" : "paid"]);
  if (options.chargeEvidence !== false && options.paidEvidence !== false) await context.admin.query("INSERT INTO treido.payment_facts(attempt_id,platform_account,livemode,kind,object_id,currency,amount_minor) VALUES($1,$2,false,'charge',$3,'eur',$4)", [attemptId, binding.platformAccount, chargeId, q.total_minor]);
  if (options.paidEvidence !== false) await context.admin.query("INSERT INTO treido.paid_orders(id,quote_id,attempt_id,seller_id,buyer_id,payment_state,fulfilment_state,settlement_state) VALUES($1,$2,$3,$4,$5,'paid','collected','transferred')", [orderId, quote.id, attemptId, published.sellerId, buyer.userId]);
  // Synthetic observed prior payment uses the exact ORIGINAL consumed resolution
  // reference, so subsequent accepted observation exercises its real predicate.
  if (options.paidEvidence !== false) await inTransaction(context.database, tx => settleAllocation(tx, q.allocation_id, "stripe:" + paymentIntentId));
  local.charges.set(chargeId, { id: chargeId, paymentIntentId, connected, total: q.total_minor, fee: q.application_fee_minor, refunded: 0, feeRefunded: 0 });
  local.intents.set(paymentIntentId, { id: paymentIntentId, object: "payment_intent", status: "succeeded", livemode: false,
    amount: q.total_minor, amount_received: q.total_minor, currency: "eur", application_fee_amount: q.application_fee_minor,
    transfer_data: { destination: connected }, on_behalf_of: connected, capture_method: "automatic", latest_charge: chargeId,
    metadata: { attempt_id: attemptId, quote_id: quote.id, seller_id: published.sellerId, application_id: binding.applicationId, environment: binding.environment } });
  return { merchant, buyer, orderId, quoteId: quote.id, attemptId, allocationId: q.allocation_id, sellerId: published.sellerId,
    listingId: published.draft.id, skuId: stock.skuId, policyId, financialId, feedbackId, feedbackHash, serviceId, chargeId,
    totalMinor: q.total_minor, feeMinor: q.application_fee_minor, serviceHash, paymentIntentId, connected, financialHash };
}
