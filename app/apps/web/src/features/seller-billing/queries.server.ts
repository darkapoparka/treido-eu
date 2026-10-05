import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { readFreeCatalogueLimits } from "../sellers/free-catalogue.server";
import { safeBillingUrl } from "./model";
import {
  billingStorageReady,
  approvedCustomer,
  catalogueColumns,
  checkedCatalogue,
  type CatalogueRow,
} from "./storage.server";
import { subscriptionBindings } from "./provider.server";
import { SellerError } from "../sellers/errors";
import {
  intentColumns,
  publicIntent,
  type BillingIntent,
} from "./commands.server";

export async function readSellerBilling(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
) {
  return inTransaction(database, async (tx) => {
    const access = await authorizeSeller(
      tx,
      identity,
      sellerId,
      "billing.manage",
    );
    const limits = await readFreeCatalogueLimits(
      tx,
      sellerId,
      access.seller.kind,
    );
    const usage = (
      await tx.client.query<{
        active: string;
        seats: string;
        variants: string;
      }>(
        `SELECT
      (SELECT count(*) FROM treido.listings WHERE seller_id=$1 AND publication='published')::text AS active,
      CASE WHEN $2='personal' THEN '1' ELSE (SELECT count(*) FROM treido.seller_memberships WHERE seller_id=$1 AND status='active')::text END AS seats,
      (SELECT COALESCE(max(n),0) FROM (SELECT count(*) AS n FROM treido.inventory_skus WHERE seller_id=$1 AND active GROUP BY listing_id) v)::text AS variants`,
        [sellerId, access.seller.kind],
      )
    ).rows[0];
    const base = {
      sellerId,
      actorKey: libraryActorKey(identity),
      actorSubject: identity.subject,
      sellerName: access.seller.name,
      kind: access.seller.kind,
      limits,
      usage: {
        drafts: limits.draftCount,
        active: Number(usage.active),
        seats: Number(usage.seats),
        variants: Number(usage.variants),
      },
    };
    if (!(await billingStorageReady(tx)))
      return {
        ...base,
        available: false,
        plans: [],
        subscription: null,
        invoices: [],
        intents: [],
      };
    let binding, customer;
    try {
      binding = subscriptionBindings();
      customer = await approvedCustomer(tx, binding, sellerId);
    } catch (error) {
      if (!(error instanceof SellerError && error.code === "NOT_AVAILABLE"))
        throw error;
      return {
        ...base,
        available: false,
        plans: [],
        subscription: null,
        invoices: [],
        intents: [],
      };
    }
    const plans = (
      await tx.client.query<CatalogueRow>(
        `SELECT ${catalogueColumns} FROM treido.billing_catalogue WHERE platform_account=$1 AND livemode=$2 AND environment=$3 AND application_id=$4 AND purpose='seller_subscription' AND seller_kind=$5 AND approved_at<=clock_timestamp() AND revoked_at IS NULL ORDER BY version DESC LIMIT 20`,
        [
          binding.platformAccount,
          binding.livemode,
          binding.environment,
          binding.applicationId,
          access.seller.kind,
        ],
      )
    ).rows.map((p) => checkedCatalogue(p, access.seller.kind));
    const subscription =
      (
        await tx.client.query<{
          id: string;
          state: string;
          cancelAtPeriodEnd: boolean;
          periodEnd: Date | null;
          catalogueId: string;
          observedAt: Date;
        }>(
          `SELECT id,state,cancel_at_period_end AS "cancelAtPeriodEnd",period_end AS "periodEnd",catalogue_id AS "catalogueId",observed_at AS "observedAt" FROM treido.billing_subscriptions WHERE seller_id=$1 AND customer_binding_id=$2 AND retired_at IS NULL`,
          [sellerId, customer.id],
        )
      ).rows[0] ?? null;
    const invoices = (
      await tx.client.query<{
        id: string;
        status: string;
        amountMinor: number;
        url: string | null;
        observedAt: Date;
      }>(
        `SELECT id,status,amount_minor AS "amountMinor",hosted_url AS url,observed_at AS "observedAt" FROM
      (SELECT DISTINCT ON (o.provider_id) o.* FROM treido.billing_invoice_observations o JOIN treido.billing_subscriptions s ON s.id=o.subscription_id WHERE s.seller_id=$1 AND s.customer_binding_id=$2 ORDER BY o.provider_id,o.observed_at DESC,o.id) v ORDER BY observed_at DESC LIMIT 50`,
        [sellerId, customer.id],
      )
    ).rows;
    const intents = (
      await tx.client.query<BillingIntent>(
        `SELECT ${intentColumns} FROM treido.billing_intents WHERE seller_id=$1 AND actor_id=$2 AND customer_binding_id=$3 ORDER BY created_at DESC LIMIT 10`,
        [sellerId, access.user.id, customer.id],
      )
    ).rows.map(publicIntent);
    return {
      ...base,
      available: plans.length > 0,
      plans: plans.map((p) => ({
        id: p.id,
        planId: p.planId,
        version: p.version,
        amountMinor: p.amountMinor,
        termsVersion: p.termsVersion,
        terms: p.terms,
      })),
      subscription: subscription
        ? {
            ...subscription,
            periodEnd: subscription.periodEnd?.toISOString() ?? null,
            observedAt: subscription.observedAt.toISOString(),
          }
        : null,
      invoices: invoices.map((i) => ({
        ...i,
        url: safeBillingUrl(i.url, "invoice"),
        observedAt: i.observedAt.toISOString(),
      })),
      intents,
    };
  });
}
export type SellerBillingView = Awaited<ReturnType<typeof readSellerBilling>>;
