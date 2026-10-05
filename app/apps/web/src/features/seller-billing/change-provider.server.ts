import "server-only";
import type Stripe from "stripe";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import { providerId } from "./provider.server";

/** Stable reviewed money/line facts; provider preview IDs/timestamps are not quote facts. */
export function invoiceReview(invoice: Stripe.Invoice) {
  if (
    invoice.currency !== "eur" ||
    invoice.lines.has_more ||
    !Number.isSafeInteger(invoice.amount_due) ||
    invoice.amount_due < 0 ||
    !Number.isSafeInteger(invoice.total) ||
    invoice.total < 0 ||
    invoice.automatic_tax.status !== "complete"
  )
    throw new SellerError("NOT_AVAILABLE");
  const facts = {
    amountMinor: invoice.amount_due,
    total: invoice.total,
    subtotal: invoice.subtotal,
    currency: "EUR",
    startingBalance: invoice.starting_balance,
    tax: invoice.total_taxes,
    discounts: invoice.total_discount_amounts,
    lines: invoice.lines.data
      .map((line) => ({
        amount: line.amount,
        currency: line.currency,
        quantity: line.quantity,
        price: providerId(line.pricing?.price_details?.price),
        period: line.period,
        proration: line.parent?.subscription_item_details?.proration ?? false,
        discounts: line.discount_amounts,
        taxes: line.taxes,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
  return {
    amountMinor: facts.amountMinor,
    currency: "EUR",
    invoiceHash: inputHash(facts),
  };
}
export function subscriptionReview(sub: Stripe.Subscription) {
  return inputHash({
    customer: providerId(sub.customer),
    items: sub.items.data.map((x) => ({
      id: x.id,
      price: x.price.id,
      quantity: x.quantity,
      start: x.current_period_start,
      end: x.current_period_end,
    })),
    latestInvoice: providerId(sub.latest_invoice),
    defaultPaymentMethod: providerId(sub.default_payment_method),
    tax: sub.automatic_tax,
    discounts: sub.discounts,
    currency: sub.currency,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    billingCycleAnchor: sub.billing_cycle_anchor,
  });
}
export function matchingChangeInvoice(
  invoice: Stripe.Invoice,
  customerId: string,
  subscriptionId: string,
  livemode: boolean,
) {
  return (
    invoice.livemode === livemode &&
    providerId(invoice.customer) === customerId &&
    providerId(invoice.parent?.subscription_details?.subscription) ===
      subscriptionId &&
    invoice.currency === "eur" &&
    invoice.billing_reason === "subscription_update" &&
    invoice.collection_method === "charge_automatically"
  );
}
/** Narrow supported v1: card, no schedules, trials, discounts, credit or pending invoices. */
export async function assertSupportedChange(
  stripe: Stripe,
  sub: Stripe.Subscription,
  customerId: string,
) {
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted)
    throw new SellerError("NOT_AVAILABLE");
  if (
    !("invoice_settings" in customer) ||
    customer.balance !== 0 ||
    sub.discounts.length ||
    sub.trial_end ||
    sub.schedule ||
    sub.pending_update ||
    sub.pause_collection ||
    sub.cancel_at_period_end ||
    !sub.automatic_tax?.enabled ||
    sub.status !== "active" ||
    sub.collection_method !== "charge_automatically" ||
    sub.default_source ||
    customer.default_source
  )
    throw new SellerError("NOT_AVAILABLE");
  const methodId =
    providerId(sub.default_payment_method) ??
    providerId(customer.invoice_settings.default_payment_method);
  if (!methodId) throw new SellerError("NOT_AVAILABLE");
  const method = await stripe.paymentMethods.retrieve(methodId);
  if (
    method.type !== "card" ||
    providerId(method.customer) !== customerId ||
    method.livemode !== sub.livemode
  )
    throw new SellerError("NOT_AVAILABLE");
  for (const status of ["open", "draft"] as const) {
    const invoices = await stripe.invoices.list({
      subscription: sub.id,
      status,
      limit: 1,
    });
    if (invoices.data.length || invoices.has_more)
      throw new SellerError("CONFLICT");
  }
}
