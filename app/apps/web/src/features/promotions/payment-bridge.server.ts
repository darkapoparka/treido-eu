import "server-only";
import { SellerError } from "../sellers/errors";
import type { SellerDatabase } from "../../server/db/database";

/** Integration contract for the sole canonical provider owner. No browser input can supply a bridge. */
export type PromotionIntent = {
  purpose: "promotion";
  attemptId: string;
  campaignId: string;
  sellerId: string;
  productId: string;
  totalMinor: number;
  currency: "EUR";
  platformAccount: string;
  environment: string;
  applicationId: string;
  livemode: boolean;
  idempotencyKey: string;
  checkoutExpiresAt: string;
  language: "bg" | "en";
};
export type PromotionPaymentBridge = {
  binding: {
    platformAccount: string;
    environment: string;
    applicationId: string;
    livemode: boolean;
  };
  create(
    intent: PromotionIntent,
  ): Promise<
    | {
        providerId: string | null;
        checkoutSessionId: string;
        checkoutUrl: string | null;
      }
    | { uncertain: true }
  >;
  observe(
    intent: PromotionIntent & {
      providerId: string | null;
      checkoutSessionId: string | null;
    },
  ): Promise<{
    purpose: "promotion";
    providerId: string | null;
    checkoutSessionId: string;
    eventId: string;
    authoritativeAt: string;
    sellerId: string;
    campaignId: string;
    attemptId: string;
    productId: string;
    totalMinor: number;
    currency: "EUR";
    platformAccount: string;
    environment: string;
    applicationId: string;
    livemode: boolean;
    state:
      "paid" | "pending" | "cancelled" | "failed" | "refunded" | "disputed";
    evidenceHash: string;
  }>;
};
/** No approved bridge has been registered in this feature's original path. Never infer one from item/subscription bindings. */
export function promotionPaymentBridge(): PromotionPaymentBridge | null {
  const platformAccount = process.env.TREIDO_STRIPE_PLATFORM_ACCOUNT,
    applicationId = process.env.TREIDO_STRIPE_APPLICATION_ID,
    environment = process.env.TREIDO_ENV,
    mode = process.env.TREIDO_STRIPE_MODE;
  if (
    !platformAccount ||
    !/^acct_[A-Za-z0-9]+$/.test(platformAccount) ||
    !applicationId ||
    !/^[a-z][a-z0-9-]{1,79}$/.test(applicationId) ||
    !environment ||
    !["development", "test", "production"].includes(environment) ||
    !["test", "live"].includes(mode ?? "") ||
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.STRIPE_PUBLISHABLE_KEY
  )
    return null;
  const binding = {
    platformAccount,
    applicationId,
    environment,
    livemode: mode === "live",
  };
  async function context() {
    const [database, payments, identity, sellers, eligibility, models, crypto] =
      await Promise.all([
        import("../../server/db/database"),
        import("../payments/bindings.server"),
        import("../../server/identity/clerk.server"),
        import("../sellers/persistence.server"),
        import("./eligibility.server"),
        import("./model"),
        import("node:crypto"),
      ]);
    const actual = payments.paymentBindings();
    if (
      Object.entries(binding).some(
        ([k, v]) => actual[k as keyof typeof actual] !== v,
      )
    )
      throw new SellerError("NOT_AVAILABLE");
    return {
      ...database,
      payments,
      identity,
      sellers,
      eligibility,
      models,
      crypto,
      actual,
    };
  }
  function correlation(intent: PromotionIntent) {
    if (
      intent.purpose !== "promotion" ||
      Object.entries(binding).some(
        ([k, v]) => intent[k as keyof PromotionIntent] !== v,
      ) ||
      !Number.isSafeInteger(intent.totalMinor) ||
      intent.totalMinor < 1 ||
      intent.currency !== "EUR" ||
      !["bg", "en"].includes(intent.language) ||
      typeof intent.checkoutExpiresAt !== "string" ||
      !Number.isFinite(Date.parse(intent.checkoutExpiresAt))
    )
      throw new Error("Promotion scope unavailable.");
  }
  type Source = {
    policyId: string;
    paymentBindingId: string;
    customerBindingId: string;
    productId: string;
    priceId: string;
    customerId: string;
    intent: PromotionIntent;
    terms: unknown;
    reviewTerms: unknown;
    termsHash: string;
    expiry: Date;
    listingId: string;
    listingRevision: number;
    kind: string;
    state: string;
  };
  type Receipt = {
    parameters: Record<string, unknown>;
    hash: string;
    key: string;
    expiry: Date;
    firstAttemptAt: Date | null;
    sessionId: string | null;
    paymentBindingId: string;
    customerBindingId: string;
  };
  const receiptSql = `SELECT parameters,parameter_hash AS hash,idempotency_key AS key,expires_at AS expiry,first_attempt_at AS "firstAttemptAt",checkout_session_id AS "sessionId",payment_binding_id AS "paymentBindingId",customer_binding_id AS "customerBindingId" FROM treido.promotion_checkout_intents WHERE attempt_id=$1`;
  async function source(
    c: Awaited<ReturnType<typeof context>>,
    intent: PromotionIntent,
  ) {
    correlation(intent);
    return c.inTransaction(c.getDatabase(), async (tx) => {
      const ready = (
        await tx.client.query<{ ready: boolean }>(
          `SELECT to_regclass('treido.promotion_payment_bindings') IS NOT NULL AND to_regclass('treido.promotion_customer_bindings') IS NOT NULL AND to_regclass('treido.promotion_checkout_intents') IS NOT NULL AS ready`,
        )
      ).rows[0];
      if (!ready?.ready) throw new SellerError("NOT_AVAILABLE");
      const row = (
        await tx.client.query<Source>(
          `SELECT pp.id AS "policyId",pb.id AS "paymentBindingId",cb.id AS "customerBindingId",pb.product_id AS "productId",pb.price_id AS "priceId",cb.provider_id AS "customerId",pa.intent,pp.terms,pr.terms AS "reviewTerms",pr.terms_hash AS "termsHash",r.expires_at AS expiry,pc.listing_id AS "listingId",pr.listing_revision AS "listingRevision",s.kind,pa.state
        FROM treido.promotion_attempts pa JOIN treido.promotion_reviews pr ON pr.id=pa.review_id JOIN treido.promotion_campaigns pc ON pc.id=pa.campaign_id JOIN treido.seller_accounts s ON s.id=pa.seller_id
        JOIN treido.promotion_products pp ON pp.id=pr.product_policy_id JOIN treido.promotion_reservations r ON r.campaign_id=pc.id
        JOIN treido.promotion_payment_bindings pb ON pb.product_policy_id=pp.id JOIN treido.promotion_customer_bindings cb ON cb.seller_id=pa.seller_id
        WHERE pa.id=$1 AND pa.seller_id=$2 AND pa.campaign_id=$3 AND pb.platform_account=$4 AND pb.livemode=$5 AND pb.environment=$6 AND pb.application_id=$7 AND pb.purpose='promotion'
        AND cb.platform_account=pb.platform_account AND cb.livemode=pb.livemode AND cb.environment=pb.environment AND cb.application_id=pb.application_id AND cb.purpose='promotion'
        AND pp.platform_account=pb.platform_account AND pp.livemode=pb.livemode AND pp.environment=pb.environment AND pp.application_id=pb.application_id
        AND pp.approved_at<=clock_timestamp() AND pp.revoked_at IS NULL AND pb.approved_at<=clock_timestamp() AND pb.revoked_at IS NULL AND cb.approved_at<=clock_timestamp() AND cb.revoked_at IS NULL`,
          [
            intent.attemptId,
            intent.sellerId,
            intent.campaignId,
            binding.platformAccount,
            binding.livemode,
            binding.environment,
            binding.applicationId,
          ],
        )
      ).rows[0];
      if (
        !row ||
        c.sellers.inputHash(row.intent) !== c.sellers.inputHash(intent) ||
        !c.models.validTerms(row.terms) ||
        !c.models.validTerms(row.reviewTerms) ||
        c.sellers.inputHash(row.terms) !==
          c.sellers.inputHash(row.reviewTerms) ||
        row.terms.productId !== intent.productId ||
        row.terms.totalMinor !== intent.totalMinor ||
        row.expiry.toISOString() !== intent.checkoutExpiresAt
      )
        throw new SellerError("NOT_AVAILABLE");
      return row;
    });
  }
  return {
    binding,
    async create(intent) {
      correlation(intent);
      const c = await context();
      if (process.env.TREIDO_STRIPE_PROMOTIONS_ENABLED !== "true")
        throw new SellerError("NOT_AVAILABLE");
      c.payments.requireCollection();
      const row = await source(c, intent),
        stripe = await c.payments.verifiedStripe(c.actual, true);
      const [price, product, customer, registrations, endpoint] =
        await Promise.all([
          stripe.prices.retrieve(row.priceId),
          stripe.products.retrieve(row.productId),
          stripe.customers.retrieve(row.customerId),
          stripe.tax.registrations.list({ status: "active", limit: 100 }),
          stripe.webhookEndpoints.retrieve(
            c.payments.requireWebhookBinding(c.actual).endpoint,
          ),
        ]);
      if (
        !price.active ||
        price.livemode !== binding.livemode ||
        price.currency !== "eur" ||
        price.unit_amount !== intent.totalMinor ||
        price.type !== "one_time" ||
        price.billing_scheme !== "per_unit" ||
        price.tax_behavior !== "inclusive" ||
        (typeof price.product === "string"
          ? price.product
          : price.product.id) !== row.productId ||
        !product.active ||
        product.livemode !== binding.livemode ||
        product.metadata.purpose !== "promotion" ||
        product.metadata.product_id !== intent.productId ||
        product.metadata.application_id !== binding.applicationId ||
        product.metadata.environment !== binding.environment ||
        ("deleted" in customer && customer.deleted) ||
        !("metadata" in customer) ||
        customer.livemode !== binding.livemode ||
        customer.metadata.purpose !== "promotion" ||
        customer.metadata.seller_id !== intent.sellerId ||
        customer.metadata.application_id !== binding.applicationId ||
        customer.metadata.environment !== binding.environment ||
        registrations.has_more ||
        !registrations.data.some(
          (r) => r.country === "BG" && r.status === "active",
        ) ||
        ![
          "checkout.session.completed",
          "checkout.session.expired",
          "checkout.session.async_payment_succeeded",
          "checkout.session.async_payment_failed",
          "payment_intent.succeeded",
          "payment_intent.canceled",
          "payment_intent.processing",
          "charge.refunded",
          "charge.dispute.created",
          "charge.dispute.closed",
        ].every(
          (t) =>
            endpoint.enabled_events.includes("*") ||
            endpoint.enabled_events.includes(t),
        )
      )
        throw new SellerError("NOT_AVAILABLE");
      const identity = await c.identity.requireVerifiedIdentity();
      if (!c.identity.hasVerifiedRecentAuthentication(identity))
        throw new SellerError("FORBIDDEN");
      const receipt = await c.inTransaction(c.getDatabase(), async (tx) => {
        const actor = await c.sellers.authorizeSeller(
          tx,
          identity,
          intent.sellerId,
          "billing.manage",
          true,
        );
        await c.sellers.authorizeSeller(
          tx,
          identity,
          intent.sellerId,
          "marketing.manage",
        );
        const attempt = (
          await tx.client.query<{
            state: string;
            intent: PromotionIntent;
            actorId: string | null;
          }>(
            `SELECT pa.state,pa.intent,(SELECT actor_id FROM treido.promotion_events e WHERE e.campaign_id=pa.campaign_id AND e.action='purchase' ORDER BY e.revision DESC LIMIT 1) AS "actorId" FROM treido.promotion_attempts pa WHERE pa.id=$1 AND pa.seller_id=$2 FOR UPDATE`,
            [intent.attemptId, intent.sellerId],
          )
        ).rows[0];
        if (
          !attempt ||
          attempt.state !== "creating" ||
          attempt.actorId !== actor.user.id ||
          c.sellers.inputHash(attempt.intent) !== c.sellers.inputHash(intent)
        )
          throw new SellerError("FORBIDDEN");
        await tx.client.query(
          "SELECT treido.lock_promotion_payment_bindings($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            row.paymentBindingId,
            row.customerBindingId,
            row.policyId,
            intent.sellerId,
            binding.platformAccount,
            binding.livemode,
            binding.environment,
            binding.applicationId,
          ],
        );
        const reservation = (
          await tx.client.query<{ expiry: Date; valid: boolean }>(
            `SELECT expires_at AS expiry,status='reserved' AND expires_at>clock_timestamp()+interval '30 minutes' AS valid FROM treido.promotion_reservations WHERE campaign_id=$1 FOR UPDATE`,
            [intent.campaignId],
          )
        ).rows[0];
        const current = await c.eligibility.currentEligible(
          tx,
          intent.sellerId,
          row.listingId,
        );
        if (
          !reservation?.valid ||
          reservation.expiry.getTime() !== row.expiry.getTime() ||
          !current ||
          current.revision !== row.listingRevision ||
          !c.identity.hasVerifiedRecentAuthentication(identity)
        )
          throw new SellerError("NOT_AVAILABLE");
        const old = (
          await tx.client.query<Receipt>(receiptSql + " FOR UPDATE", [
            intent.attemptId,
          ])
        ).rows[0];
        if (old?.firstAttemptAt) return null;
        const language = intent.language,
          url =
            c.actual.origin +
            "/app/sellers/" +
            intent.sellerId +
            "/promotions?lang=" +
            language,
          metadata = {
            purpose: "promotion",
            attempt_id: intent.attemptId,
            campaign_id: intent.campaignId,
            seller_id: intent.sellerId,
            product_id: intent.productId,
            application_id: binding.applicationId,
            environment: binding.environment,
          },
          parameters = {
            mode: "payment",
            ui_mode: "hosted_page",
            customer: row.customerId,
            line_items: [{ price: row.priceId, quantity: 1 }],
            automatic_tax: { enabled: true },
            customer_update: { address: "auto" },
            locale: language,
            expires_at: Math.floor(row.expiry.getTime() / 1000),
            success_url: url,
            cancel_url: url,
            metadata,
            payment_intent_data: { metadata },
            client_reference_id: intent.attemptId,
            integration_identifier:
              "treido-promotion-" +
              Array.from(c.crypto.randomBytes(8), (b) =>
                String.fromCharCode(97 + (b % 26)),
              ).join(""),
          };
        if (!old)
          await tx.client.query(
            `INSERT INTO treido.promotion_checkout_intents(attempt_id,payment_binding_id,customer_binding_id,parameters,parameter_hash,idempotency_key,api_version,expires_at) VALUES($1,$2,$3,$4,$5,$6,'2026-09-30.endive',$7)`,
            [
              intent.attemptId,
              row.paymentBindingId,
              row.customerBindingId,
              parameters,
              c.sellers.inputHash(parameters),
              intent.idempotencyKey,
              row.expiry,
            ],
          );
        return (
          (
            await tx.client.query<Receipt>(
              `UPDATE treido.promotion_checkout_intents SET first_attempt_at=clock_timestamp() WHERE attempt_id=$1 AND first_attempt_at IS NULL AND expires_at>clock_timestamp()+interval '30 minutes' RETURNING parameters,parameter_hash AS hash,idempotency_key AS key,expires_at AS expiry,first_attempt_at AS "firstAttemptAt",checkout_session_id AS "sessionId",payment_binding_id AS "paymentBindingId",customer_binding_id AS "customerBindingId"`,
              [intent.attemptId],
            )
          ).rows[0] ?? null
        );
      });
      if (!receipt) return { uncertain: true };
      if (
        receipt.hash !== c.sellers.inputHash(receipt.parameters) ||
        receipt.key !== intent.idempotencyKey ||
        !c.identity.hasVerifiedRecentAuthentication(identity)
      )
        return { uncertain: true };
      try {
        const session = await stripe.checkout.sessions.create(
          receipt.parameters as Parameters<
            typeof stripe.checkout.sessions.create
          >[0],
          { idempotencyKey: receipt.key },
        );
        const { safeBillingUrl } = await import("../seller-billing/model"),
          url = safeBillingUrl(session.url, "checkout");
        if (
          !url ||
          session.livemode !== binding.livemode ||
          session.mode !== "payment" ||
          session.client_reference_id !== intent.attemptId ||
          session.metadata?.purpose !== "promotion" ||
          session.metadata.attempt_id !== intent.attemptId ||
          session.metadata.seller_id !== intent.sellerId ||
          session.metadata.campaign_id !== intent.campaignId ||
          session.metadata.product_id !== intent.productId ||
          session.metadata.application_id !== binding.applicationId ||
          session.metadata.environment !== binding.environment ||
          (typeof session.customer === "string"
            ? session.customer
            : session.customer?.id) !== receipt.parameters.customer ||
          session.expires_at !== receipt.parameters.expires_at ||
          session.amount_total !== intent.totalMinor ||
          session.currency !== "eur"
        )
          return { uncertain: true };
        await c.inTransaction(c.getDatabase(), (tx) =>
          tx.client.query(
            "UPDATE treido.promotion_checkout_intents SET checkout_session_id=$2 WHERE attempt_id=$1 AND checkout_session_id IS NULL",
            [intent.attemptId, session.id],
          ),
        );
        return {
          providerId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
          checkoutSessionId: session.id,
          checkoutUrl: url,
        };
      } catch {
        return { uncertain: true };
      }
    },
    async observe(intent) {
      correlation(intent);
      const c = await context(),
        stripe = await c.payments.verifiedStripe(c.actual),
        database = c.getDatabase();
      const receipt = (
        await database.pool.query<Receipt>(receiptSql, [intent.attemptId])
      ).rows[0];
      if (
        !receipt ||
        receipt.hash !== c.sellers.inputHash(receipt.parameters) ||
        !receipt.firstAttemptAt ||
        receipt.key !== intent.idempotencyKey ||
        receipt.expiry.toISOString() !== intent.checkoutExpiresAt ||
        receipt.parameters.expires_at !==
          Math.floor(Date.parse(intent.checkoutExpiresAt) / 1000)
      )
        throw new SellerError("NOT_AVAILABLE");
      const sessionId = intent.checkoutSessionId ?? receipt.sessionId,
        list = sessionId
          ? {
              data: [await stripe.checkout.sessions.retrieve(sessionId)],
              has_more: false,
            }
          : await stripe.checkout.sessions.list({
              customer: receipt.parameters.customer as string,
              limit: 100,
              created: {
                gte: Math.floor(receipt.firstAttemptAt.getTime() / 1000) - 1,
              },
            });
      if (list.has_more) throw new SellerError("NOT_AVAILABLE");
      const matches = list.data.filter(
        (s) =>
          s.metadata?.purpose === "promotion" &&
          s.metadata.attempt_id === intent.attemptId,
      );
      if (matches.length !== 1) throw new SellerError("NOT_AVAILABLE");
      const session = matches[0],
        m = session.metadata;
      if (
        (sessionId && session.id !== sessionId) ||
        session.livemode !== binding.livemode ||
        session.mode !== "payment" ||
        session.currency !== "eur" ||
        session.amount_total !== intent.totalMinor ||
        session.expires_at !== receipt.parameters.expires_at ||
        session.client_reference_id !== intent.attemptId ||
        m?.seller_id !== intent.sellerId ||
        m.campaign_id !== intent.campaignId ||
        m.product_id !== intent.productId ||
        m.application_id !== binding.applicationId ||
        m.environment !== binding.environment ||
        (typeof session.customer === "string"
          ? session.customer
          : session.customer?.id) !== receipt.parameters.customer
      )
        throw new SellerError("FORBIDDEN");
      const lines = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 2,
        }),
        expected = (
          receipt.parameters.line_items as { price: string; quantity: number }[]
        )[0];
      if (
        lines.has_more ||
        lines.data.length !== 1 ||
        lines.data[0].price?.id !== expected.price ||
        lines.data[0].quantity !== 1
      )
        throw new SellerError("FORBIDDEN");
      const providerId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      if (intent.providerId && intent.providerId !== providerId)
        throw new SellerError("CONFLICT");
      const signal = (
        await database.pool.query<{ id: string; at: Date }>(
          `SELECT si.event_id AS id,si.provider_created_at AS at FROM treido.promotion_provider_signals si JOIN treido.stripe_webhook_receipts r ON r.platform_account=si.platform_account AND r.livemode=si.livemode AND r.event_id=si.event_id WHERE si.platform_account=$1 AND si.livemode=$2 AND si.attempt_id=$3 AND si.provider_id IN ($4,$5) AND ($5::text IS NOT NULL OR (r.event_type='checkout.session.expired' AND r.object_id=$4)) AND NOT EXISTS(SELECT 1 FROM treido.promotion_provider_events e WHERE e.platform_account=si.platform_account AND e.livemode=si.livemode AND e.event_id=si.event_id) ORDER BY si.provider_created_at,si.event_id LIMIT 1`,
          [
            binding.platformAccount,
            binding.livemode,
            intent.attemptId,
            session.id,
            providerId,
          ],
        )
      ).rows[0];
      if (!signal) throw new SellerError("NOT_AVAILABLE");
      let state:
          | "paid"
          | "pending"
          | "cancelled"
          | "failed"
          | "refunded"
          | "disputed" = "pending",
        chargeId: string | null = null,
        refundedMinor = 0;
      if (!providerId) {
        if (session.status !== "expired")
          throw new SellerError("NOT_AVAILABLE");
        state = "cancelled";
      } else {
        const payment = await stripe.paymentIntents.retrieve(providerId),
          p = payment.metadata;
        if (
          payment.livemode !== binding.livemode ||
          payment.currency !== "eur" ||
          payment.amount !== intent.totalMinor ||
          p.purpose !== "promotion" ||
          p.attempt_id !== intent.attemptId ||
          p.seller_id !== intent.sellerId ||
          p.campaign_id !== intent.campaignId ||
          p.product_id !== intent.productId ||
          p.application_id !== binding.applicationId ||
          p.environment !== binding.environment ||
          (typeof payment.customer === "string"
            ? payment.customer
            : payment.customer?.id) !== receipt.parameters.customer
        )
          throw new SellerError("FORBIDDEN");
        if (payment.status === "canceled") state = "cancelled";
        if (payment.status === "succeeded") {
          chargeId =
            typeof payment.latest_charge === "string"
              ? payment.latest_charge
              : (payment.latest_charge?.id ?? null);
          if (!chargeId) throw new SellerError("NOT_AVAILABLE");
          const charge = await stripe.charges.retrieve(chargeId);
          const { capturedChargeMatches } =
            await import("../seller-billing/payment-evidence");
          if (
            !capturedChargeMatches(charge, {
              chargeId,
              customerId: receipt.parameters.customer as string,
              paymentIntentId: providerId,
              livemode: binding.livemode,
              amountMinor: intent.totalMinor,
            }) ||
            payment.amount_received !== intent.totalMinor
          )
            throw new SellerError("FORBIDDEN");
          refundedMinor = charge.amount_refunded;
          state = charge.disputed
            ? "disputed"
            : refundedMinor > 0
              ? "refunded"
              : "paid";
        }
      }
      await c.inTransaction(database, (tx) =>
        tx.client.query(
          "UPDATE treido.promotion_checkout_intents SET checkout_session_id=$2 WHERE attempt_id=$1 AND checkout_session_id IS NULL",
          [intent.attemptId, session.id],
        ),
      );
      const fact = {
        purpose: "promotion" as const,
        providerId,
        checkoutSessionId: session.id,
        eventId: signal.id,
        authoritativeAt: signal.at.toISOString(),
        sellerId: intent.sellerId,
        campaignId: intent.campaignId,
        attemptId: intent.attemptId,
        productId: intent.productId,
        totalMinor: intent.totalMinor,
        currency: "EUR" as const,
        ...binding,
        state,
      };
      return {
        ...fact,
        evidenceHash: c.sellers.inputHash({ ...fact, chargeId, refundedMinor }),
      };
    },
  };
}

export type PromotionProviderWork = (
  database: SellerDatabase,
  attemptId: string,
  bridge: PromotionPaymentBridge,
) => Promise<void>;
