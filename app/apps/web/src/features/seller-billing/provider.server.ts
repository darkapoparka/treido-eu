import "server-only";
import type Stripe from "stripe";
import {
  verifiedStripe,
  requireCollection,
  requireWebhookBinding,
  type PaymentBindings,
} from "../payments/bindings.server";
import { SellerError } from "../sellers/errors";
import type { CatalogueRow, CustomerRow } from "./storage.server";

export const BILLING_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.updated",
  "invoice.voided",
  "invoice.marked_uncollectible",
  "credit_note.created",
  "credit_note.updated",
  "charge.refunded",
  "charge.updated",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.closed",
];
export function subscriptionBindings() {
  if (process.env.TREIDO_STRIPE_SUBSCRIPTIONS_ENABLED !== "true")
    throw new SellerError("NOT_AVAILABLE");
  return requireCollection();
}
export function providerId(x: unknown): string | null {
  return typeof x === "string"
    ? x
    : x && typeof x === "object" && "id" in x && typeof x.id === "string"
      ? x.id
      : null;
}
export async function qualifiedBillingProvider(
  binding: PaymentBindings,
  customer: CustomerRow,
  sellerId: string,
  plan: CatalogueRow,
  operation: string,
) {
  const stripe = await verifiedStripe(binding, operation !== "cancel");
  const remoteCustomer = await stripe.customers.retrieve(customer.providerId);
  if (
    ("deleted" in remoteCustomer && remoteCustomer.deleted) ||
    !("metadata" in remoteCustomer) ||
    remoteCustomer.livemode !== binding.livemode ||
    remoteCustomer.metadata.seller_id !== sellerId ||
    remoteCustomer.metadata.purpose !== "seller_subscription" ||
    remoteCustomer.metadata.application_id !== binding.applicationId ||
    remoteCustomer.metadata.environment !== binding.environment
  )
    throw new SellerError("NOT_AVAILABLE");
  // Stopping future renewal must remain possible when a catalogue price/tax/portal is retired.
  if (operation === "cancel") return stripe;
  const [price, product, endpoint, registrations, portal] = await Promise.all([
    stripe.prices.retrieve(plan.priceId),
    stripe.products.retrieve(plan.productId),
    stripe.webhookEndpoints.retrieve(requireWebhookBinding(binding).endpoint),
    stripe.tax.registrations.list({ status: "active", limit: 100 }),
    stripe.billingPortal.configurations.retrieve(
      operation === "change"
        ? plan.changeConfiguration
        : plan.portalConfiguration,
    ),
  ]);
  if (
    !price.active ||
    price.livemode !== binding.livemode ||
    providerId(price.product) !== product.id ||
    product.id !== plan.productId ||
    !product.active ||
    product.livemode !== binding.livemode ||
    price.currency !== "eur" ||
    price.unit_amount !== plan.amountMinor ||
    price.billing_scheme !== "per_unit" ||
    price.type !== "recurring" ||
    price.recurring?.interval !== "month" ||
    price.recurring.interval_count !== 1 ||
    price.recurring.usage_type !== "licensed" ||
    price.tax_behavior !== "exclusive" ||
    product.metadata.purpose !== "seller_subscription" ||
    product.metadata.application_id !== binding.applicationId ||
    product.metadata.environment !== binding.environment ||
    endpoint.livemode !== binding.livemode ||
    !BILLING_EVENTS.every(
      (type) =>
        endpoint.enabled_events.includes("*") ||
        endpoint.enabled_events.includes(
          type as Stripe.WebhookEndpointCreateParams.EnabledEvent,
        ),
    ) ||
    registrations.has_more ||
    !registrations.data.some(
      (r) => r.country === "BG" && r.status === "active",
    ) ||
    !portal.active ||
    portal.livemode !== binding.livemode ||
    portal.features.subscription_cancel.enabled ||
    portal.metadata?.application_id !== binding.applicationId ||
    portal.metadata?.environment !== binding.environment ||
    portal.metadata?.purpose !== "seller_subscription"
  )
    throw new SellerError("NOT_AVAILABLE");
  if (operation === "change") {
    const update = portal.features.subscription_update;
    if (
      !update.enabled ||
      update.proration_behavior !== "always_invoice" ||
      !update.products?.length ||
      !update.products.every(
        (p) =>
          p.product === plan.productId &&
          p.prices.length > 0 &&
          p.prices.every((price) => price === plan.priceId),
      )
    )
      throw new SellerError("NOT_AVAILABLE");
  } else if (portal.features.subscription_update.enabled)
    throw new SellerError("NOT_AVAILABLE");
  return stripe;
}
