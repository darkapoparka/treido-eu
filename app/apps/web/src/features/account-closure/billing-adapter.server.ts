import "server-only";
import type { SellerDatabase } from "../../server/db/database";
import { inTransaction } from "../../server/db/database";
import { paymentBindings } from "../payments/bindings.server";
import {
  approvedCustomer,
  catalogueColumns,
  type CatalogueRow,
} from "../seller-billing/storage.server";
import {
  qualifiedBillingProvider,
  providerId,
} from "../seller-billing/provider.server";
import { ClosureError } from "./model";
import type { EffectRow, LifecycleBinding } from "./storage.server";
import type { ProviderOutcome } from "./clerk-adapter.server";
export async function billingEffectAdapter(
  database: SellerDatabase,
  binding: LifecycleBinding,
  effect: EffectRow,
) {
  const payment = paymentBindings(),
    target = effect.target;
  if (
    payment.platformAccount !== binding.stripeAccount ||
    payment.livemode !== binding.stripeMode ||
    payment.applicationId !== binding.stripeApplicationId ||
    payment.environment !== binding.environment ||
    typeof target.sellerId !== "string" ||
    typeof target.subscriptionId !== "string" ||
    typeof target.catalogueId !== "string" ||
    typeof target.customerBindingId !== "string" ||
    typeof target.expectedPriceId !== "string"
  )
    throw new ClosureError("BINDING_REQUIRED");
  const sellerId = target.sellerId,
    subscriptionId = target.subscriptionId,
    expectedPriceId = target.expectedPriceId;
  const { customer, plan } = await inTransaction(database, async (tx) => {
    const own = (
      await tx.client.query(
        `SELECT s.id FROM treido.seller_accounts s JOIN treido.personal_seller_owners o ON o.seller_id=s.id WHERE s.id=$1 AND o.user_id=$2 AND s.kind='personal' FOR SHARE OF s,o`,
        [target.sellerId, effect.userId],
      )
    ).rows[0];
    if (!own) throw new ClosureError("FORBIDDEN");
    const customer = await approvedCustomer(tx, payment, sellerId);
    if (customer.id !== target.customerBindingId)
      throw new ClosureError("FORBIDDEN");
    const plan = (
      await tx.client.query<CatalogueRow>(
        `SELECT ${catalogueColumns} FROM treido.billing_catalogue WHERE id=$1 AND seller_kind='personal'`,
        [target.catalogueId],
      )
    ).rows[0];
    const original = (
      await tx.client.query(
        `SELECT id FROM treido.billing_subscriptions WHERE seller_id=$1 AND provider_id=$2 AND customer_binding_id=$3 AND catalogue_id=$4`,
        [
          target.sellerId,
          target.subscriptionId,
          target.customerBindingId,
          target.catalogueId,
        ],
      )
    ).rows[0];
    if (!plan || !original || plan.priceId !== target.expectedPriceId)
      throw new ClosureError("FORBIDDEN");
    return { customer, plan };
  });
  const stripe = await qualifiedBillingProvider(
    payment,
    customer,
    sellerId,
    plan,
    "cancel",
  );
  const retrieve = async () => {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (
      subscription.livemode !== payment.livemode ||
      providerId(subscription.customer) !== customer.providerId ||
      subscription.metadata.purpose !== "seller_subscription" ||
      subscription.metadata.seller_id !== sellerId ||
      subscription.metadata.application_id !== payment.applicationId ||
      subscription.metadata.environment !== payment.environment ||
      !subscription.items.data.some((item) => item.price.id === expectedPriceId)
    )
      throw new ClosureError("FORBIDDEN");
    return subscription;
  };
  await retrieve();
  const observe = async (): Promise<ProviderOutcome> => {
    const value = await retrieve();
    return {
      state:
        value.cancel_at_period_end || value.status === "canceled"
          ? "confirmed"
          : "unknown",
      evidence: {
        kind: "billing.stop-renewal",
        status: value.status,
        cancelAtPeriodEnd: value.cancel_at_period_end,
      },
    };
  };
  return {
    observe,
    execute: async (): Promise<ProviderOutcome> => {
      await stripe.subscriptions.update(
        subscriptionId,
        { cancel_at_period_end: true, proration_behavior: "none" },
        { idempotencyKey: "treido:account-closure:" + effect.operationKey },
      );
      return observe();
    },
  };
}
