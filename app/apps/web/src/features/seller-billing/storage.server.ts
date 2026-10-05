import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { PaymentBindings } from "../payments/bindings.server";
import { SellerError } from "../sellers/errors";
import { PLANS, type Limits, type PlanId, type SellerKind } from "./model";

export async function billingStorageReady(tx: SellerTransaction) {
  const row = (
    await tx.client.query<{ ready: boolean }>(`SELECT
    to_regclass('treido.billing_catalogue') IS NOT NULL AND to_regclass('treido.billing_customers') IS NOT NULL
    AND to_regclass('treido.billing_intents') IS NOT NULL AND to_regclass('treido.billing_subscriptions') IS NOT NULL
    AND to_regclass('treido.billing_paid_intervals') IS NOT NULL AND to_regclass('treido.billing_revocations') IS NOT NULL
    AND to_regclass('treido.billing_invoice_observations') IS NOT NULL AND to_regclass('treido.billing_sync') IS NOT NULL AND to_regclass('treido.billing_payment_links') IS NOT NULL AS ready`)
  ).rows[0];
  return row?.ready === true;
}
export type CatalogueRow = {
  id: string;
  planId: PlanId;
  version: number;
  kind: SellerKind;
  priceId: string;
  productId: string;
  amountMinor: number;
  limits: Limits;
  terms: { bg: string; en: string };
  termsVersion: string;
  portalConfiguration: string;
  changeConfiguration: string;
};
export async function billingRecoveryReady(tx: SellerTransaction) {
  const row = (
    await tx.client.query<{ ready: boolean }>(
      "SELECT to_regclass('treido.billing_recovery_requests') IS NOT NULL AS ready",
    )
  ).rows[0];
  return row?.ready === true;
}
export function checkedCatalogue(
  row: CatalogueRow | undefined,
  kind: SellerKind,
) {
  if (
    !row ||
    row.kind !== kind ||
    row.planId !== kind + "_pro" ||
    row.version < 1 ||
    !Number.isSafeInteger(row.amountMinor) ||
    row.amountMinor < 1 ||
    JSON.stringify(Object.entries(row.limits).sort()) !==
      JSON.stringify(Object.entries(PLANS[row.planId].limits).sort()) ||
    !row.terms ||
    ![row.terms.bg, row.terms.en].every(
      (t) => typeof t === "string" && t.trim().length > 0 && t.length <= 12000,
    ) ||
    !row.termsVersion ||
    row.termsVersion.length > 100
  )
    throw new SellerError("NOT_AVAILABLE");
  return row;
}
export const catalogueColumns = `id,plan_id AS "planId",version,seller_kind AS kind,price_id AS "priceId",product_id AS "productId",
 amount_minor AS "amountMinor",limits,terms,terms_version AS "termsVersion",portal_configuration AS "portalConfiguration",change_configuration AS "changeConfiguration"`;
export async function approvedCatalogue(
  tx: SellerTransaction,
  binding: PaymentBindings,
  kind: SellerKind,
  planId: PlanId,
  version: number,
) {
  return checkedCatalogue(
    (
      await tx.client.query<CatalogueRow>(
        `SELECT ${catalogueColumns} FROM treido.billing_catalogue
    WHERE platform_account=$1 AND livemode=$2 AND environment=$3 AND application_id=$4 AND purpose='seller_subscription'
    AND plan_id=$5 AND version=$6 AND approved_at<=clock_timestamp() AND revoked_at IS NULL`,
        [
          binding.platformAccount,
          binding.livemode,
          binding.environment,
          binding.applicationId,
          planId,
          version,
        ],
      )
    ).rows[0],
    kind,
  );
}
export type CustomerRow = { id: string; providerId: string };
export async function approvedCustomer(
  tx: SellerTransaction,
  binding: PaymentBindings,
  sellerId: string,
) {
  const row = (
    await tx.client.query<CustomerRow>(
      `SELECT id,provider_id AS "providerId" FROM treido.billing_customers
    WHERE seller_id=$1 AND platform_account=$2 AND livemode=$3 AND environment=$4 AND application_id=$5
    AND purpose='seller_subscription' AND approved_at<=clock_timestamp() AND revoked_at IS NULL`,
      [
        sellerId,
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
/** Callers hold the existing seller_usage lock, serializing quota and lifecycle changes.
 * Free is an existing base right. Missing optional billing storage never fabricates a paid grant.
 * Database errors propagate; they do not become successful Free/Pro observations. */
export async function readSellerEntitlements(
  tx: SellerTransaction,
  sellerId: string,
  kind: SellerKind,
) {
  const free = {
    ...PLANS[(kind + "_free") as PlanId].limits,
    planId: (kind + "_free") as PlanId,
    planVersion: 1,
    paidUntil: null as string | null,
  };
  if (!(await billingStorageReady(tx))) return free;
  const mode = process.env.TREIDO_STRIPE_MODE,
    platform = process.env.TREIDO_STRIPE_PLATFORM_ACCOUNT,
    app = process.env.TREIDO_STRIPE_APPLICATION_ID,
    environment = process.env.TREIDO_ENV;
  if (
    !["test", "live"].includes(mode ?? "") ||
    !platform ||
    !app ||
    !environment
  )
    return free;
  const row = (
    await tx.client.query<CatalogueRow & { endsAt: Date }>(
      `SELECT c.id,c.plan_id AS "planId",c.version,c.seller_kind AS kind,
    c.price_id AS "priceId",c.product_id AS "productId",c.amount_minor AS "amountMinor",c.limits,c.terms,c.terms_version AS "termsVersion",
    c.portal_configuration AS "portalConfiguration",c.change_configuration AS "changeConfiguration",i.ends_at AS "endsAt"
    FROM treido.billing_subscriptions s JOIN treido.billing_customers b ON b.id=s.customer_binding_id AND b.seller_id=s.seller_id
    JOIN treido.billing_paid_intervals i ON i.subscription_id=s.id JOIN treido.billing_catalogue c ON c.id=i.catalogue_id AND c.id=s.catalogue_id
    WHERE s.seller_id=$1 AND s.retired_at IS NULL AND s.state IN ('active','past_due')
    AND b.platform_account=$2 AND b.livemode=$3 AND b.environment=$4 AND b.application_id=$5 AND b.purpose='seller_subscription'
    AND c.platform_account=b.platform_account AND c.livemode=b.livemode AND c.environment=b.environment AND c.application_id=b.application_id
    AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL AND c.approved_at<=clock_timestamp() AND c.revoked_at IS NULL
    AND i.starts_at<=clock_timestamp() AND clock_timestamp()<i.ends_at
    AND NOT EXISTS(SELECT 1 FROM treido.billing_revocations r WHERE r.subscription_id=s.id AND r.invoice_id=i.invoice_id)
    ORDER BY i.ends_at DESC LIMIT 1`,
      [sellerId, platform, mode === "live", environment, app],
    )
  ).rows[0];
  if (!row) return free;
  const plan = checkedCatalogue(row, kind);
  return {
    ...plan.limits,
    planId: plan.planId,
    planVersion: plan.version,
    paidUntil: row.endsAt.toISOString(),
  };
}
