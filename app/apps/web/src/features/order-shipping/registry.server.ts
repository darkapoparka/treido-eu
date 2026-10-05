import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  approvedListing,
  approvedPolicy,
  sellerBinding,
} from "../payments/registry.server";
import { paymentBindings } from "../payments/bindings.server";
import { feeMinor } from "../payments/model";
import { readFinancialPolicy } from "../order-aftercare/policy.server";
import { RECIPIENT_FIELDS, shippingCosts, type ShippingCosts } from "./model";
import type {
  CarrierBinding,
  ShippingPolicy,
  ShippingRate,
  ShippingOption,
} from "./view";
import type { shippingSource } from "./source.server";

export function policyHash(policy: Omit<ShippingPolicy, "id" | "termsHash">) {
  const {
    version,
    basePolicyId,
    financialPolicyId,
    environment,
    applicationId,
    platformAccount,
    livemode,
    countries,
    fields,
    requiredFields,
    recipientPurpose,
    retentionDescription,
    terms,
    rights,
    refundTerms,
    taxDescription,
    taxBasis,
    shippingRefund,
    commissionBasis,
    quoteValidity,
    reviewSeconds,
    unacceptedRecipientSeconds,
    acceptedRecipientSeconds,
    retentionVersion,
  } = policy;
  return inputHash({
    format: "shipping-policy-v1",
    version,
    basePolicyId,
    financialPolicyId,
    environment,
    applicationId,
    platformAccount,
    livemode,
    countries,
    fields,
    requiredFields,
    recipientPurpose,
    retentionDescription,
    terms,
    rights,
    refundTerms,
    taxDescription,
    taxBasis,
    shippingRefund,
    commissionBasis,
    quoteValidity,
    reviewSeconds,
    unacceptedRecipientSeconds,
    acceptedRecipientSeconds,
    retentionVersion,
  });
}
export function bindingHash(
  binding: Omit<CarrierBinding, "id" | "bindingHash">,
) {
  const {
    policyId,
    sellerId,
    version,
    country,
    method,
    carrierCode,
    carrierLabel,
    officeCodes,
    sourceKind,
  } = binding;
  return inputHash({
    format: "shipping-carrier-v1",
    policyId,
    sellerId,
    version,
    country,
    method,
    carrierCode,
    carrierLabel,
    officeCodes,
    sourceKind,
  });
}
export function rateHash(rate: Omit<ShippingRate, "id" | "rateHash">) {
  const {
    bindingId,
    version,
    shippingMinor,
    buyerFeeMinor,
    taxMinor,
    taxBasis,
    maximumUnits,
    maximumMerchandiseMinor,
    validUntil,
    sourceReference,
    sourceHash,
    merchandiseMinor,
  } = rate;
  return inputHash({
    format: "shipping-tariff-v1",
    bindingId,
    version,
    shippingMinor,
    buyerFeeMinor,
    taxMinor,
    taxBasis,
    maximumUnits,
    maximumMerchandiseMinor,
    validUntil,
    sourceReference,
    sourceHash,
    merchandiseMinor,
  });
}
export async function shippingStorageAvailable(tx: SellerTransaction) {
  const count = (
    await tx.client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM unnest(ARRAY['order_shipping_policies','order_shipping_carriers','order_shipping_rates','order_shipping_choices','order_shipping_recipients','order_shipping_receipts']) name WHERE to_regclass('treido.'||name) IS NOT NULL",
    )
  ).rows[0]?.n;
  if (count === 0) return false;
  if (count !== 6) throw new SellerError("NOT_AVAILABLE");
  return true;
}
/** Canonical owner registers the existing job/lifecycle aggregation, not a UI flag. */
export async function shippingRetentionReady(
  tx: SellerTransaction,
  policy: ShippingPolicy,
) {
  const exists = (
    await tx.client.query<{ present: boolean }>(
      "SELECT to_regprocedure('treido.order_shipping_retention_ready(uuid,text,text)') IS NOT NULL AS present",
    )
  ).rows[0];
  if (!exists?.present) return false;
  return (
    (
      await tx.client.query<{ ready: boolean }>(
        "SELECT treido.order_shipping_retention_ready($1,$2,$3) AS ready",
        [policy.id, policy.environment, policy.applicationId],
      )
    ).rows[0]?.ready === true
  );
}
export async function readShippingOption(
  tx: SellerTransaction,
  supply: Awaited<ReturnType<typeof shippingSource>>,
  policyId: string,
  rateId: string,
): Promise<ShippingOption> {
  const binding = paymentBindings();
  const row = (
    await tx.client.query<{ payload: ShippingPolicy; termsHash: string }>(
      'SELECT payload,terms_hash AS "termsHash" FROM treido.order_shipping_policies WHERE id=$1 AND platform_account=$2 AND livemode=$3 AND environment=$4 AND application_id=$5 AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE',
      [
        policyId,
        binding.platformAccount,
        binding.livemode,
        binding.environment,
        binding.applicationId,
      ],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_AVAILABLE");
  const policy = { ...row.payload, id: policyId, termsHash: row.termsHash };
  if (
    policyHash(policy) !== policy.termsHash ||
    policy.retentionVersion !== "order-shipping-v1" ||
    policy.quoteValidity !== "original_allocation_within_tariff" ||
    policy.platformAccount !== binding.platformAccount ||
    policy.livemode !== binding.livemode ||
    policy.environment !== binding.environment ||
    policy.applicationId !== binding.applicationId ||
    !policy.fields.length ||
    policy.fields.some((field) => !RECIPIENT_FIELDS.includes(field)) ||
    policy.requiredFields.some((field) => !policy.fields.includes(field)) ||
    !(await shippingRetentionReady(tx, policy))
  )
    throw new SellerError("NOT_AVAILABLE");
  const base = await approvedPolicy(tx, policy.basePolicyId, binding);
  await sellerBinding(tx, supply.sellerId, binding);
  for (const line of supply.lines)
    await approvedListing(tx, supply.sellerId, line, policy.basePolicyId);
  const financial = await readFinancialPolicy(
    tx,
    { policyId: policy.basePolicyId, ...binding },
    policy.financialPolicyId,
  );
  if (
    !financial ||
    financial.method !== "shipping" ||
    !financial.trackingAllowed ||
    financial.taxBasis !== policy.taxBasis ||
    policy.taxBasis !== "inclusive_unspecified"
  )
    throw new SellerError("NOT_AVAILABLE");
  const rateRow = (
    await tx.client.query<{
      payload: ShippingRate;
      rateHash: string;
      bindingId: string;
    }>(
      'SELECT payload,rate_hash AS "rateHash",carrier_binding_id AS "bindingId" FROM treido.order_shipping_rates WHERE id=$1 AND policy_id=$2 AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND valid_until>clock_timestamp() FOR SHARE',
      [rateId, policyId],
    )
  ).rows[0];
  if (!rateRow) throw new SellerError("NOT_AVAILABLE");
  const rate = { ...rateRow.payload, id: rateId, rateHash: rateRow.rateHash };
  const carrierRow = (
    await tx.client.query<{ payload: CarrierBinding; bindingHash: string }>(
      'SELECT payload,binding_hash AS "bindingHash" FROM treido.order_shipping_carriers WHERE id=$1 AND policy_id=$2 AND seller_id=$3 AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE',
      [rateRow.bindingId, policyId, supply.sellerId],
    )
  ).rows[0];
  if (!carrierRow) throw new SellerError("NOT_AVAILABLE");
  const carrier = {
    ...carrierRow.payload,
    id: rateRow.bindingId,
    bindingHash: carrierRow.bindingHash,
  };
  if (
    rateHash(rate) !== rate.rateHash ||
    bindingHash(carrier) !== carrier.bindingHash ||
    rate.bindingId !== carrier.id ||
    carrier.policyId !== policy.id ||
    carrier.sellerId !== supply.sellerId ||
    !policy.countries.includes(carrier.country) ||
    carrier.sourceKind !== "approved_seller_tariff" ||
    rate.taxBasis !== policy.taxBasis ||
    rate.buyerFeeMinor !== 0 ||
    (rate.taxBasis !== "inclusive_unspecified" &&
      (rate.sourceHash !== supply.sourceHash ||
        rate.merchandiseMinor !== supply.merchandiseMinor)) ||
    supply.merchandiseMinor > rate.maximumMerchandiseMinor ||
    supply.lines.reduce((sum, line) => sum + line.quantity, 0) >
      rate.maximumUnits ||
    (carrier.method === "address" &&
      (!policy.requiredFields.includes("address") ||
        !policy.requiredFields.includes("city"))) ||
    (carrier.method === "collection_office" &&
      (!policy.requiredFields.includes("officeCode") ||
        !Array.isArray(carrier.officeCodes) ||
        carrier.officeCodes.length < 1 ||
        carrier.officeCodes.length > 100 ||
        new Set(carrier.officeCodes).size !== carrier.officeCodes.length ||
        carrier.officeCodes.some(
          (code) =>
            typeof code !== "string" ||
            !code.trim() ||
            code.length > 100 ||
            /[\u0000-\u001f\u007f]/.test(code),
        )))
  )
    throw new SellerError("NOT_AVAILABLE");
  const commissionBase =
    supply.merchandiseMinor +
    (policy.commissionBasis === "merchandise_and_shipping"
      ? rate.shippingMinor
      : 0);
  let costs: ShippingCosts;
  try {
    costs = shippingCosts({
      merchandiseMinor: supply.merchandiseMinor,
      shippingMinor: rate.shippingMinor,
      buyerFeeMinor: rate.buyerFeeMinor,
      taxMinor: rate.taxMinor,
      taxBasis: rate.taxBasis,
      applicationFeeMinor: feeMinor(
        commissionBase,
        base.feeBps,
        base.feeFixedMinor,
      ),
    });
  } catch {
    throw new SellerError("NOT_AVAILABLE");
  }
  return {
    policy,
    binding: carrier,
    rate,
    costs,
    financial: {
      id: financial.id,
      version: financial.version,
      termsHash: financial.termsHash,
      terms: financial.terms,
      retentionDescription: financial.recipientRetentionDescription,
    },
    optionHash: inputHash({
      format: "shipping-option-v1",
      policyId,
      policyHash: policy.termsHash,
      financialId: financial.id,
      financialHash: financial.termsHash,
      carrierId: carrier.id,
      carrierHash: carrier.bindingHash,
      rateId,
      rateHash: rate.rateHash,
      costs,
    }),
  };
}
