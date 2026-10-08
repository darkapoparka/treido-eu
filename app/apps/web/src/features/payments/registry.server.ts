import "server-only";
import type Stripe from "stripe";
import type { SellerTransaction } from "../../server/db/database";
import type { PaymentBindings } from "./bindings.server";
import { SellerError } from "../sellers/errors";

export type SellerPaymentBinding = {
  id: string;
  sellerId: string;
  connectedAccount: string;
  platformAccount: string;
  livemode: boolean;
};
export type PaymentPolicy = {
  id: string;
  feeBps: number;
  feeFixedMinor: number;
  settlementMerchant: "platform" | "seller";
  approvalReference: string;
  buyerTerms: { bg: string; en: string };
};
export async function sellerBinding(
  tx: SellerTransaction,
  sellerId: string,
  binding: PaymentBindings,
) {
  const lock = await tx.client.query<{ id: string | null }>(
    `SELECT treido.lock_seller_payment_binding($1,$2,$3) AS id`,
    [sellerId, binding.platformAccount, binding.livemode],
  );
  if (!lock.rows[0]?.id) throw new SellerError("NOT_AVAILABLE");
  const row = (
    await tx.client.query<SellerPaymentBinding>(
      `SELECT id,seller_id AS "sellerId",connected_account AS "connectedAccount",platform_account AS "platformAccount",livemode
    FROM treido.seller_payment_bindings WHERE seller_id=$1 AND platform_account=$2 AND livemode=$3 AND approved_at<=clock_timestamp() AND revoked_at IS NULL`,
      [sellerId, binding.platformAccount, binding.livemode],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_AVAILABLE");
  return row;
}
export async function approvedPolicy(
  tx: SellerTransaction,
  id: string,
  binding: PaymentBindings,
) {
  const lock = await tx.client.query<{ id: string | null }>(
    `SELECT treido.lock_payment_policy($1,$2,$3,$4,$5) AS id`,
    [
      id,
      binding.platformAccount,
      binding.livemode,
      binding.environment,
      binding.applicationId,
    ],
  );
  if (!lock.rows[0]?.id) throw new SellerError("NOT_AVAILABLE");
  const row = (
    await tx.client.query<PaymentPolicy>(
      `SELECT id,fee_bps AS "feeBps",fee_fixed_minor AS "feeFixedMinor",settlement_merchant AS "settlementMerchant",approval_reference AS "approvalReference",buyer_terms AS "buyerTerms"
    FROM treido.payment_policies WHERE id=$1 AND platform_account=$2 AND livemode=$3 AND environment=$4 AND application_id=$5 AND approved_at<=clock_timestamp() AND revoked_at IS NULL`,
      [
        id,
        binding.platformAccount,
        binding.livemode,
        binding.environment,
        binding.applicationId,
      ],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_AVAILABLE");
  return row;
}
export async function approvedListing(
  tx: SellerTransaction,
  sellerId: string,
  line: { listingId: string; publicationRevision: number },
  policyId: string,
) {
  const row = await tx.client.query<{ id: string | null }>(
    `SELECT treido.lock_payable_listing_terms($1,$2,$3,$4) AS id`,
    [sellerId, line.listingId, line.publicationRevision, policyId],
  );
  if (row.rows[0]?.id !== policyId) throw new SellerError("NOT_AVAILABLE");
}
export function connectAccountFacts(account: Stripe.Account) {
  const requirements = account.requirements;
  return {
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    detailsSubmitted: account.details_submitted === true,
    cardPayments: account.capabilities?.card_payments ?? "unrequested",
    transfers: account.capabilities?.transfers ?? "unrequested",
    currentlyDue: requirements?.currently_due ?? [],
    pastDue: requirements?.past_due ?? [],
    pendingVerification: requirements?.pending_verification ?? [],
    disabledReason: requirements?.disabled_reason ?? null,
    checkedAt: new Date().toISOString(),
  };
}
export function accountReadiness(
  account: Stripe.Account,
  settlementMerchant: unknown,
) {
  const policy =
    settlementMerchant === "platform" || settlementMerchant === "seller"
      ? settlementMerchant
      : null;
  const requirements = account.requirements;
  return {
    ...connectAccountFacts(account),
    settlementMerchant: policy,
    policyQualified: policy !== null,
    ready:
      policy !== null &&
      account.country === "BG" &&
      account.default_currency === "eur" &&
      account.payouts_enabled === true &&
      account.details_submitted === true &&
      account.capabilities?.transfers === "active" &&
      // Destination recipients do not process the platform's charge. Seller
      // settlement uses on_behalf_of and requires current merchant acceptance.
      (policy === "platform" ||
        (account.charges_enabled === true &&
          account.capabilities?.card_payments === "active")) &&
      !requirements?.disabled_reason &&
      !requirements?.currently_due?.length &&
      !requirements?.past_due?.length,
  };
}
