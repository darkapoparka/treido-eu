import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import { validId } from "../selling/draft-model";
import type { ReviewSource } from "../purchase-reviews/model";
import { parseChoice, type ShippingChoice, type Language } from "./model";
import { shippingSource } from "./source.server";
import { readShippingOption } from "./registry.server";
import {
  shippingActor,
  ownedShippingRow,
  ownRecipient,
} from "./storage.server";
import type { ShippingBridge, ShippingReview } from "./view";

export type ShippingQuoteScope = {
  buyerId: string;
  sellerId: string;
  basePolicyId: string;
  source: ReviewSource;
  language: Language;
  allocationId: string;
  originalExpiresAt: string;
  originalExpiresAtExact: string;
  merchandiseMinor: number;
  platformAccount: string;
  livemode: boolean;
  environment: string;
  applicationId: string;
};
/** T64 calls INSIDE the existing quote transaction after its source/allocation locks.
 * It never creates/replaces a hold, extends expiry or performs an external call. */
export async function lockShippingChoiceForQuote(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  raw: ShippingChoice,
  scope: ShippingQuoteScope,
): Promise<ShippingBridge> {
  const choice = parseChoice(raw);
  const buyer = await shippingActor(tx, identity);
  if (buyer.id !== scope.buyerId || !validId(scope.allocationId))
    throw new SellerError("FORBIDDEN");
  const supply = await shippingSource(
    tx,
    identity,
    scope.source,
    scope.allocationId,
  );
  const row = await ownedShippingRow(tx, buyer.id, choice.id, true);
  const option = await readShippingOption(
    tx,
    supply,
    row.snapshot.option.policy.id,
    row.snapshot.option.rate.id,
  );
  const p = option.policy,
    deadline = new Date(scope.originalExpiresAt).getTime();
  if (
    row.state !== "accepted" ||
    row.expired ||
    row.revision !== choice.revision ||
    row.snapshotHash !== choice.snapshotHash ||
    row.sellerId !== scope.sellerId ||
    row.snapshot.language !== scope.language ||
    row.snapshot.sourceHash !== supply.sourceHash ||
    inputHash(scope.source) !== inputHash(row.snapshot.source) ||
    supply.merchandiseMinor !== scope.merchandiseMinor ||
    option.optionHash !== row.snapshot.option.optionHash ||
    p.basePolicyId !== scope.basePolicyId ||
    p.platformAccount !== scope.platformAccount ||
    p.livemode !== scope.livemode ||
    p.environment !== scope.environment ||
    p.applicationId !== scope.applicationId ||
    !Number.isFinite(deadline) ||
    deadline > new Date(option.rate.validUntil).getTime() ||
    (supply.allocationId !== null &&
      (supply.allocationId !== scope.allocationId ||
        supply.originalSourceExpiresAt !== scope.originalExpiresAt)) ||
    !(await ownRecipient(tx, row)).value
  )
    throw new SellerError("NOT_AVAILABLE");
  const allocation = (
    await tx.client.query<{ valid: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM treido.inventory_allocations WHERE id=$1 AND buyer_id=$2 AND seller_id=$3 AND state='active' AND expires_at=$4::timestamptz AND expires_at<=$5::timestamptz AND expires_at>clock_timestamp()) AS valid",
      [
        scope.allocationId,
        buyer.id,
        scope.sellerId,
        scope.originalExpiresAtExact,
        option.rate.validUntil,
      ],
    )
  ).rows[0];
  if (!allocation?.valid) throw new SellerError("CONFLICT");
  const language = row.snapshot.language;
  return {
    format: "goods-shipping-v1",
    choice,
    policyId: p.id,
    policyVersion: p.version,
    policyHash: p.termsHash,
    financialPolicyId: p.financialPolicyId,
    carrierBindingId: option.binding.id,
    carrierBindingHash: option.binding.bindingHash,
    rateId: option.rate.id,
    rateHash: option.rate.rateHash,
    recipientRef: row.id,
    country: row.snapshot.country,
    method: "shipping",
    sourceHash: row.snapshot.sourceHash,
    costs: row.snapshot.option.costs,
    shippingRefund: p.shippingRefund,
    terms: p.terms[language],
    rights: p.rights[language],
    refundTerms: p.refundTerms[language],
    taxDescription: p.taxDescription[language],
    recipientPurpose: p.recipientPurpose[language],
    retentionDescription: p.retentionDescription[language],
    aftercare: {
      policyId: option.financial.id,
      version: option.financial.version,
      termsHash: option.financial.termsHash,
      acknowledged: true,
      buyerTerms: option.financial.terms[language],
    },
  };
}
/** Same original quote transaction, after its immutable quote and lines INSERT. */
export async function persistShippingQuoteChoice(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  choice: ShippingChoice,
  quoteId: string,
) {
  if (!validId(quoteId)) throw new SellerError("INVALID_INPUT");
  const buyer = await shippingActor(tx, identity),
    parsed = parseChoice(choice);
  const row = await ownedShippingRow(tx, buyer.id, parsed.id, true);
  if (row.state === "bound" && row.quoteId === quoteId) return;
  if (
    row.state !== "accepted" ||
    row.expired ||
    row.revision !== parsed.revision ||
    row.snapshotHash !== parsed.snapshotHash
  )
    throw new SellerError("CONFLICT");
  const q = (
    await tx.client.query<{ valid: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM treido.payable_quotes q JOIN treido.inventory_allocations a ON a.id=q.allocation_id WHERE q.id=$1 AND q.buyer_id=$2 AND q.seller_id=$3 AND q.currency='EUR' AND q.total_minor=$4 AND q.application_fee_minor=$5 AND q.expires_at<=$6::timestamptz AND q.expires_at=a.expires_at AND a.buyer_id=q.buyer_id AND a.seller_id=q.seller_id AND a.state='active' AND a.expires_at>clock_timestamp() AND q.language=$9 AND q.terms_snapshot->>'handover'='shipping' AND q.terms_snapshot->'shipping'->'choice'->>'id'=$7 AND q.terms_snapshot->'shipping'->'choice'->>'snapshotHash'=$8) AS valid",
      [
        quoteId,
        buyer.id,
        row.sellerId,
        row.snapshot.option.costs.totalMinor,
        row.snapshot.option.costs.applicationFeeMinor,
        row.snapshot.option.rate.validUntil,
        row.id,
        row.snapshotHash,
        row.snapshot.language,
      ],
    )
  ).rows[0];
  if (!q?.valid) throw new SellerError("CONFLICT");
  await tx.client.query(
    "UPDATE treido.order_shipping_choices SET state='bound',revision=revision+1,quote_id=$2,bound_at=clock_timestamp() WHERE id=$1",
    [row.id, quoteId],
  );
  // Exactly once, from original binding time and approved immutable policy. Retries never extend.
  await tx.client.query(
    "UPDATE treido.order_shipping_recipients r SET retain_until=c.bound_at+make_interval(secs=>$2) FROM treido.order_shipping_choices c WHERE r.choice_id=$1 AND r.buyer_id=$3 AND c.id=r.choice_id AND r.value IS NOT NULL",
    [row.id, row.snapshot.option.policy.acceptedRecipientSeconds, buyer.id],
  );
}
export async function shippingQuoteBridgeReady(
  tx: SellerTransaction,
  review: ShippingReview,
) {
  if (review.state !== "accepted" || review.expired || !review.recipient)
    return false;
  const present = (
    await tx.client.query<{ present: boolean }>(
      "SELECT to_regprocedure('treido.order_shipping_quote_ready(uuid,text,text)') IS NOT NULL AS present",
    )
  ).rows[0];
  if (!present?.present) return false;
  const p = review.snapshot.option.policy;
  return (
    (
      await tx.client.query<{ ready: boolean }>(
        "SELECT treido.order_shipping_quote_ready($1,$2,$3) AS ready",
        [p.id, p.environment, p.applicationId],
      )
    ).rows[0]?.ready === true
  );
}
