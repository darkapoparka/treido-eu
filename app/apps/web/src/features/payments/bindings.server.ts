import "server-only";
import Stripe from "stripe";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { SellerError } from "../sellers/errors";

export type PaymentBindings = Readonly<{
  platformAccount: string;
  livemode: boolean;
  environment: string;
  applicationId: string;
  origin: string;
  publishableKey: string;
  collectionEnabled: boolean;
}>;
export function paymentBindings(): PaymentBindings {
  const backend = requireBackendBindings();
  const env = process.env,
    mode = env.TREIDO_STRIPE_MODE;
  const livemode = mode === "live";
  const secret = env.STRIPE_SECRET_KEY ?? "",
    publishable = env.STRIPE_PUBLISHABLE_KEY ?? "";
  const platform = env.TREIDO_STRIPE_PLATFORM_ACCOUNT ?? "";
  const applicationId = env.TREIDO_STRIPE_APPLICATION_ID ?? "";
  const origin = backend.application.origin;
  if (
    !["test", "live"].includes(mode ?? "") ||
    !/^acct_[A-Za-z0-9]+$/.test(platform) ||
    !new RegExp(`^(sk|rk)_${livemode ? "live" : "test"}_[A-Za-z0-9]+$`).test(
      secret,
    ) ||
    !new RegExp(`^pk_${livemode ? "live" : "test"}_[A-Za-z0-9]+$`).test(
      publishable,
    ) ||
    !/^[a-z][a-z0-9-]{1,79}$/.test(applicationId)
  )
    throw new SellerError("NOT_AVAILABLE");
  return Object.freeze({
    platformAccount: platform,
    livemode,
    environment: backend.environment,
    applicationId,
    origin,
    publishableKey: publishable,
    collectionEnabled: env.TREIDO_STRIPE_COLLECTION_ENABLED === "true",
  });
}
export function requireCollection() {
  const binding = paymentBindings();
  if (!binding.collectionEnabled) throw new SellerError("NOT_AVAILABLE");
  requireWebhookBinding(binding);
  return binding;
}
export function requireWebhookBinding(binding = paymentBindings()) {
  const signing = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const endpoint = process.env.TREIDO_STRIPE_WEBHOOK_ENDPOINT_ID ?? "";
  if (
    !/^whsec_[A-Za-z0-9]+$/.test(signing) ||
    !/^we_[A-Za-z0-9]+$/.test(endpoint) ||
    process.env.TREIDO_STRIPE_WEBHOOK_SCOPE !== "platform" ||
    process.env.TREIDO_STRIPE_WEBHOOK_PLATFORM_ACCOUNT !==
      binding.platformAccount ||
    process.env.TREIDO_STRIPE_WEBHOOK_MODE !==
      (binding.livemode ? "live" : "test")
  )
    throw new SellerError("NOT_AVAILABLE");
  return { signing, endpoint };
}
export function stripeClient() {
  paymentBindings();
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    maxNetworkRetries: 0,
    timeout: 15000,
    telemetry: false,
  });
}
/** Key ownership is verified from Stripe, not from a configured account ID alone. */
export async function verifiedStripe(
  binding = paymentBindings(),
  forCollection = false,
) {
  const stripe = stripeClient();
  const platform = await stripe.accounts.retrieve(null);
  if (platform.id !== binding.platformAccount || platform.country !== "BG")
    throw new SellerError("NOT_AVAILABLE");
  if (forCollection) {
    if (
      !binding.collectionEnabled ||
      !platform.charges_enabled ||
      !platform.payouts_enabled ||
      platform.default_currency !== "eur"
    )
      throw new SellerError("NOT_AVAILABLE");
    const registered = requireWebhookBinding(binding),
      endpoint = await stripe.webhookEndpoints.retrieve(registered.endpoint);
    const expected = [
      "payment_intent.succeeded",
      "payment_intent.processing",
      "payment_intent.payment_failed",
      "payment_intent.canceled",
      "charge.updated",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.updated",
      "charge.dispute.closed",
      "refund.created",
      "refund.updated",
      "refund.failed",
    ];
    if (
      endpoint.livemode !== binding.livemode ||
      endpoint.status !== "enabled" ||
      endpoint.url !== new URL("/api/stripe/webhook", binding.origin).href ||
      endpoint.metadata.treido_application_id !== binding.applicationId ||
      endpoint.metadata.treido_environment !== binding.environment ||
      !expected.every(
        (type) =>
          endpoint.enabled_events.includes("*") ||
          endpoint.enabled_events.includes(type),
      )
    )
      throw new SellerError("NOT_AVAILABLE");
  }
  return stripe;
}
