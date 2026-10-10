import "server-only";
import { randomUUID, randomBytes } from "node:crypto";
import type Stripe from "stripe";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { enqueueJob } from "../../server/jobs/outbox.server";
import {
  paymentBindings,
  type PaymentBindings,
} from "../payments/bindings.server";
import {
  parseBillingCommand,
  safeBillingUrl,
  type BillingCommand,
} from "./model";
import {
  approvedCatalogue,
  approvedCustomer,
  billingStorageReady,
  billingRecoveryReady,
  catalogueColumns,
  checkedCatalogue,
  type CatalogueRow,
} from "./storage.server";
import {
  providerId,
  qualifiedBillingProvider,
  subscriptionBindings,
} from "./provider.server";
import { pendingChange } from "./recovery-model";
import {
  assertSupportedChange,
  invoiceReview,
  subscriptionReview,
  matchingChangeInvoice,
} from "./change-provider.server";

export type BillingIntent = {
  id: string;
  sellerId: string;
  actorId: string;
  requestId: string;
  inputHash: string;
  operation: BillingCommand["operation"];
  catalogueId: string;
  customerBindingId: string;
  subscriptionId: string | null;
  parameters: Record<string, unknown>;
  expectedPriceId: string;
  parameterHash: string;
  idempotencyKey: string;
  expiresAt: Date;
  state: string;
  providerId: string | null;
  hostedUrl: string | null;
  firstAttemptAt: Date | null;
  revision: number;
  changeInvoiceId: string | null;
  result: {
    amountMinor: number;
    currency: string;
    prorationDate: number;
    previousPrice: string;
    invoiceHash?: string;
    subscriptionHash?: string;
    reviewHash?: string;
    monthlyAmountMinor?: number;
    termsVersion?: string;
  } | null;
};
export const intentColumns = `id,seller_id AS "sellerId",actor_id AS "actorId",request_id AS "requestId",input_hash AS "inputHash",operation,
 catalogue_id AS "catalogueId",customer_binding_id AS "customerBindingId",subscription_id AS "subscriptionId",parameters,
 expected_price_id AS "expectedPriceId",parameter_hash AS "parameterHash",idempotency_key AS "idempotencyKey",expires_at AS "expiresAt",state,provider_id AS "providerId",hosted_url AS "hostedUrl",result,first_attempt_at AS "firstAttemptAt",revision,change_invoice_id AS "changeInvoiceId"`;
async function lockUsage(tx: SellerTransaction, sellerId: string) {
  const row = await tx.client.query(
    "SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR UPDATE",
    [sellerId],
  );
  if (!row.rowCount) throw new SellerError("NOT_AVAILABLE");
}
async function lockApproval(
  tx: SellerTransaction,
  intent: BillingIntent,
  binding: PaymentBindings,
) {
  await tx.client.query(
    "SELECT treido.lock_billing_registry($1,$2,$3,$4,$5,$6,$7)",
    [
      intent.operation === "cancel" ? null : intent.catalogueId,
      intent.customerBindingId,
      intent.sellerId,
      binding.platformAccount,
      binding.livemode,
      binding.environment,
      binding.applicationId,
    ],
  );
}
export async function enqueueBillingObservation(
  tx: SellerTransaction,
  intent: Pick<BillingIntent, "id" | "sellerId">,
  operationKey: string = randomUUID(),
) {
  if (!validId(operationKey)) throw new SellerError("INVALID_INPUT");
  return enqueueJob(tx, {
    kind: "billing.reconcile",
    sellerId: intent.sellerId,
    resourceId: intent.id,
    operationKey,
    actorId: null,
    authority: "service",
  });
}
export async function prepareBillingIntent(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseBillingCommand(raw);
  if (!command) throw new SellerError("INVALID_INPUT");
  if (
    command.actorKey !== libraryActorKey(identity) ||
    !hasVerifiedRecentAuthentication(identity)
  )
    throw new SellerError("FORBIDDEN");
  const binding = subscriptionBindings();
  return inTransaction(database, async (tx) => {
    const access = await authorizeSeller(
      tx,
      identity,
      command.sellerId,
      "billing.manage",
    );
    await lockUsage(tx, command.sellerId);
    if (!(await billingStorageReady(tx)) || !(await billingRecoveryReady(tx)))
      throw new SellerError("NOT_AVAILABLE");
    const hash = inputHash(command);
    const prior = (
      await tx.client.query<BillingIntent>(
        `SELECT ${intentColumns} FROM treido.billing_intents WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3 FOR UPDATE`,
        [command.sellerId, access.user.id, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.inputHash !== hash) throw new SellerError("CONFLICT");
      return prior;
    }
    const count = (
      await tx.client.query<{ count: string }>(
        "SELECT count(*) FROM treido.billing_intents WHERE actor_id=$1 AND seller_id=$2 AND created_at>clock_timestamp()-interval '1 minute'",
        [access.user.id, command.sellerId],
      )
    ).rows[0];
    if (Number(count.count) >= 10) throw new SellerError("QUOTA_EXCEEDED");
    const customer = await approvedCustomer(tx, binding, command.sellerId);
    const subscription = (
      await tx.client.query<{
        id: string;
        providerId: string;
        catalogueId: string;
        itemId: string;
        state: string;
        retiredAt: Date | null;
      }>(
        `SELECT id,provider_id AS "providerId",catalogue_id AS "catalogueId",item_id AS "itemId",state,retired_at AS "retiredAt" FROM treido.billing_subscriptions WHERE seller_id=$1 AND customer_binding_id=$2 AND retired_at IS NULL FOR UPDATE`,
        [command.sellerId, customer.id],
      )
    ).rows[0];
    if (
      command.operation === "checkout"
        ? !!subscription
        : !subscription || subscription.retiredAt !== null
    )
      throw new SellerError("CONFLICT");
    let plan: CatalogueRow;
    if (command.planId && command.version)
      plan = await approvedCatalogue(
        tx,
        binding,
        access.seller.kind,
        command.planId,
        command.version,
      );
    else {
      const current = (
        await tx.client.query<CatalogueRow>(
          `SELECT ${catalogueColumns} FROM treido.billing_catalogue WHERE id=$1`,
          [subscription!.catalogueId],
        )
      ).rows[0];
      plan = checkedCatalogue(current, access.seller.kind);
    }
    const previousPrice = subscription
      ? (
          await tx.client.query<{ price: string }>(
            "SELECT price_id AS price FROM treido.billing_catalogue WHERE id=$1",
            [subscription.catalogueId],
          )
        ).rows[0]?.price
      : plan.priceId;
    if (!previousPrice) throw new SellerError("NOT_AVAILABLE");
    const now = (
        await tx.client.query<{ now: Date }>("SELECT clock_timestamp() AS now")
      ).rows[0].now,
      id = randomUUID(),
      expiresAt = new Date(
        now.getTime() + (command.operation === "preview" ? 10 : 45) * 60000,
      ),
      returnUrl =
        binding.origin +
        "/app/sellers/" +
        command.sellerId +
        "/billing?lang=" +
        command.language,
      metadata = {
        purpose: "seller_subscription",
        application_id: binding.applicationId,
        environment: binding.environment,
        seller_id: command.sellerId,
        billing_intent_id: id,
        catalogue_id: plan.id,
      };
    let parameters: Record<string, unknown>;
    if (command.operation === "checkout") {
      parameters = {
        mode: "subscription",
        customer: customer.providerId,
        line_items: [{ price: plan.priceId, quantity: 1 }],
        locale: command.language,
        ui_mode: "hosted_page",
        automatic_tax: { enabled: true },
        customer_update: { address: "auto" },
        success_url: returnUrl,
        cancel_url: returnUrl,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        client_reference_id: id,
        metadata,
        subscription_data: { metadata },
        integration_identifier:
          "treido-seller-subscription-" +
          randomBytes(8).toString("hex").replace(/[0-9]/g, "a"),
      };
    } else if (command.operation === "cancel")
      parameters = { cancel_at_period_end: true };
    else if (command.operation === "preview") {
      if (plan.id === subscription!.catalogueId)
        throw new SellerError("CONFLICT");
      parameters = {
        customer: customer.providerId,
        subscription: subscription!.providerId,
        subscription_details: {
          items: [
            { id: subscription!.itemId, price: plan.priceId, quantity: 1 },
          ],
          proration_behavior: "always_invoice",
          proration_date: Math.floor(now.getTime() / 1000),
        },
      };
    } else if (command.operation === "portal") {
      parameters = {
        customer: customer.providerId,
        configuration: plan.portalConfiguration,
        locale: command.language,
        return_url: returnUrl,
      };
    } else {
      const preview = (
        await tx.client.query<BillingIntent>(
          `SELECT ${intentColumns} FROM treido.billing_intents WHERE id=$1 AND seller_id=$2 AND actor_id=$3 AND operation='preview' AND state='ready' AND expires_at>clock_timestamp() FOR SHARE`,
          [command.previewId, command.sellerId, access.user.id],
        )
      ).rows[0];
      if (
        !preview?.result ||
        preview.result.previousPrice !== previousPrice ||
        preview.catalogueId !== plan.id ||
        preview.subscriptionId !== subscription!.providerId ||
        preview.customerBindingId !== customer.id ||
        !preview.result.reviewHash ||
        preview.result.reviewHash !== command.reviewHash
      )
        throw new SellerError("CONFLICT");
      parameters = {
        payment_behavior: "pending_if_incomplete",
        proration_behavior: "always_invoice",
        proration_date: preview.result.prorationDate,
        items: [{ id: subscription!.itemId, price: plan.priceId, quantity: 1 }],
        metadata: { billing_change_intent_id: id },
        expand: ["latest_invoice"],
      };
    }
    const pending = (
      await tx.client.query(
        `SELECT id FROM treido.billing_intents WHERE seller_id=$1 AND customer_binding_id=$2 AND operation IN ('checkout','change') AND state IN ('prepared','creating','reconciling','ready') LIMIT 1`,
        [command.sellerId, customer.id],
      )
    ).rows[0];
    if (pending && ["checkout", "change"].includes(command.operation))
      throw new SellerError("CONFLICT");
    await tx.client.query(
      "SELECT treido.lock_billing_registry($1,$2,$3,$4,$5,$6,$7)",
      [
        command.operation === "cancel" ? null : plan.id,
        customer.id,
        command.sellerId,
        binding.platformAccount,
        binding.livemode,
        binding.environment,
        binding.applicationId,
      ],
    );
    const acceptedReview =
      command.operation === "change"
        ? (
            await tx.client.query<BillingIntent>(
              `SELECT ${intentColumns} FROM treido.billing_intents WHERE id=$1`,
              [command.previewId],
            )
          ).rows[0].result
        : null;
    const row = (
      await tx.client.query<BillingIntent>(
        `INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,subscription_id,preview_id,parameters,parameter_hash,idempotency_key,api_version,expires_at,expected_price_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING ${intentColumns}`,
        [
          id,
          command.sellerId,
          access.user.id,
          command.requestId,
          hash,
          command.operation,
          plan.id,
          customer.id,
          subscription?.providerId ?? null,
          command.previewId,
          parameters,
          inputHash(parameters),
          "seller-billing:" + id,
          "2026-09-30.endive",
          expiresAt,
          previousPrice,
        ],
      )
    ).rows[0];
    if (acceptedReview) {
      const saved = (
        await tx.client.query<BillingIntent>(
          `UPDATE treido.billing_intents SET result=$2 WHERE id=$1 RETURNING ${intentColumns}`,
          [row.id, acceptedReview],
        )
      ).rows[0];
      return saved;
    }
    return row;
  });
}
export async function recoverBillingIntent(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  requestId: string,
  actorKey: string,
) {
  if (actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const access = await authorizeSeller(
      tx,
      identity,
      sellerId,
      "billing.manage",
    );
    if (!(await billingStorageReady(tx)) || !(await billingRecoveryReady(tx)))
      throw new SellerError("NOT_AVAILABLE");
    const row = (
      await tx.client.query<BillingIntent>(
        `SELECT ${intentColumns} FROM treido.billing_intents WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3`,
        [sellerId, access.user.id, requestId],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    return publicIntent(row);
  });
}
export function publicIntent(row: BillingIntent) {
  const directChange =
    row.operation === "change" && pendingChange(row.parameters);
  const legacyChange = row.operation === "change" && !directChange && row.firstAttemptAt !== null;
  const url =
    row.hostedUrl &&
    !legacyChange &&
    row.state === "ready" &&
    (directChange || row.expiresAt.getTime() > Date.now())
      ? safeBillingUrl(
          row.hostedUrl,
          directChange
            ? "invoice"
            : row.operation === "checkout"
              ? "checkout"
              : "portal",
        )
      : null;
  return {
    id: row.id,
    requestId: row.requestId,
    operation: row.operation,
    state: row.state,
    expiresAt: row.expiresAt.toISOString(),
    url,
    preview: row.operation === "preview" ? row.result : null,
    acceptedChange: directChange && row.result ? {
      amountMinor: row.result.amountMinor, currency: row.result.currency,
      monthlyAmountMinor: row.result.monthlyAmountMinor ?? null,
      termsVersion: row.result.termsVersion ?? null,
      prorationDate: row.result.prorationDate,
    } : null,
    revision: row.revision,
    recovery:
      row.operation === "change" &&
      !pendingChange(row.parameters) &&
      row.firstAttemptAt
        ? ("legacy" as const)
        : row.operation === "change" && row.changeInvoiceId
          ? ("invoice" as const)
          : row.state === "prepared" && !row.firstAttemptAt
            ? ("unattempted" as const)
            : ("observe" as const),
  };
}
/** Only the original prepared intent can attempt a provider write. Creating/unknown is READ-only recovery. */
export async function executeBillingIntent(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  prepared: BillingIntent,
) {
  const binding = subscriptionBindings();
  const facts = await inTransaction(database, async (tx) => {
    const access = await authorizeSeller(
      tx,
      identity,
      prepared.sellerId,
      "billing.manage",
    );
    await lockUsage(tx, prepared.sellerId);
    const row = (
      await tx.client.query<BillingIntent>(
        `SELECT ${intentColumns} FROM treido.billing_intents WHERE id=$1 AND seller_id=$2 AND actor_id=$3 FOR UPDATE`,
        [prepared.id, prepared.sellerId, access.user.id],
      )
    ).rows[0];
    if (!row || row.parameterHash !== inputHash(row.parameters))
      throw new SellerError("CONFLICT");
    const customer = await approvedCustomer(tx, binding, row.sellerId);
    if (customer.id !== row.customerBindingId)
      throw new SellerError("CONFLICT");
    const plan = checkedCatalogue(
      (
        await tx.client.query<CatalogueRow>(
          `SELECT ${catalogueColumns} FROM treido.billing_catalogue WHERE id=$1`,
          [row.catalogueId],
        )
      ).rows[0],
      access.seller.kind,
    );
    await lockApproval(tx, row, binding);
    return { row, customer, plan };
  });
  if (facts.row.state !== "prepared") return publicIntent(facts.row);
  if (facts.row.operation === "change" && !pendingChange(facts.row.parameters))
    throw new SellerError("CONFLICT"); // Never create another legacy money portal.
  let reviewedSubscription: Stripe.Subscription | null = null;
  const stripe = await qualifiedBillingProvider(
    binding,
    facts.customer,
    facts.row.sellerId,
    facts.plan,
    facts.row.operation,
  );
  if (facts.row.operation === "checkout") {
    const existing = await stripe.subscriptions.list({
      customer: facts.customer.providerId,
      status: "all",
      limit: 100,
    });
    if (
      existing.has_more ||
      existing.data.some(
        (s) => !["canceled", "incomplete_expired"].includes(s.status),
      )
    )
      throw new SellerError("CONFLICT");
  } else {
    const current = await stripe.subscriptions.retrieve(
      facts.row.subscriptionId!,
    );
    if (
      current.livemode !== binding.livemode ||
      providerId(current.customer) !== facts.customer.providerId ||
      current.metadata.seller_id !== facts.row.sellerId ||
      current.metadata.application_id !== binding.applicationId ||
      current.metadata.environment !== binding.environment ||
      current.metadata.purpose !== "seller_subscription" ||
      current.items.data.length !== 1 ||
      current.items.has_more ||
      current.items.data[0].quantity !== 1 ||
      current.pending_update ||
      current.schedule ||
      current.pause_collection ||
      ["canceled", "incomplete_expired", "paused"].includes(current.status)
    )
      throw new SellerError("CONFLICT");
    if (facts.row.operation === "change" || facts.row.operation === "preview") {
      const expectedItem =
        facts.row.operation === "preview"
          ? (
              facts.row
                .parameters as unknown as Stripe.InvoiceCreatePreviewParams
            ).subscription_details?.items?.[0]?.id
          : (facts.row.parameters as unknown as Stripe.SubscriptionUpdateParams)
              .items?.[0]?.id;
      if (
        current.items.data[0].id !== expectedItem ||
        current.items.data[0].price.id !== facts.row.expectedPriceId ||
        current.items.data[0].price.id === facts.plan.priceId ||
        current.status !== "active"
      )
        throw new SellerError("CONFLICT");
      await assertSupportedChange(stripe, current, facts.customer.providerId);
      reviewedSubscription = current;
      if (facts.row.operation === "change") {
        if (
          !facts.row.result?.invoiceHash ||
          !facts.row.result.subscriptionHash ||
          subscriptionReview(current) !== facts.row.result.subscriptionHash
        )
          throw new SellerError("CONFLICT");
        const fresh = await stripe.invoices.createPreview({
          customer: facts.customer.providerId,
          subscription: current.id,
          subscription_details: {
            items: (facts.row.parameters as Stripe.SubscriptionUpdateParams)
              .items,
            proration_behavior: "always_invoice",
            proration_date: facts.row.result.prorationDate,
          },
        });
        if (invoiceReview(fresh).invoiceHash !== facts.row.result.invoiceHash)
          throw new SellerError("CONFLICT");
      }
    }
  }
  const claimed = await inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, prepared.sellerId, "billing.manage");
    await lockUsage(tx, prepared.sellerId);
    if (!hasVerifiedRecentAuthentication(identity))
      throw new SellerError("FORBIDDEN");
    await lockApproval(tx, facts.row, binding);
    if (facts.row.operation === "change") {
      const preview = await tx.client.query(
        `SELECT id FROM treido.billing_intents WHERE id=(SELECT preview_id FROM treido.billing_intents WHERE id=$1)
         AND state='ready' AND expires_at>clock_timestamp() FOR SHARE`,
        [prepared.id],
      );
      if (!preview.rowCount) throw new SellerError("CONFLICT");
    }
    const row = (
      await tx.client.query<BillingIntent>(
        `UPDATE treido.billing_intents SET state='creating',first_attempt_at=clock_timestamp(),updated_at=clock_timestamp()
      WHERE id=$1 AND state='prepared' AND revision=$3 AND expires_at>clock_timestamp()+make_interval(secs=>$2) RETURNING ${intentColumns}`,
        [
          prepared.id,
          facts.row.operation === "checkout" ? 1800 : 0,
          facts.row.revision,
        ],
      )
    ).rows[0];
    if (row) await enqueueBillingObservation(tx, row);
    return row;
  });
  if (!claimed)
    return recoverBillingIntent(
      database,
      identity,
      prepared.sellerId,
      prepared.requestId,
      libraryActorKey(identity),
    );
  let providerObjectId: string | null = null,
    changeInvoiceId: string | null = null,
    hostedUrl: string | null = null,
    result: BillingIntent["result"] = null;
  try {
    if (!hasVerifiedRecentAuthentication(identity))
      throw new SellerError("FORBIDDEN");
    const options = { idempotencyKey: claimed.idempotencyKey };
    if (claimed.operation === "checkout") {
      const response = await stripe.checkout.sessions.create(
        claimed.parameters as Stripe.Checkout.SessionCreateParams,
        options,
      );
      providerObjectId = response.id;
      hostedUrl = safeBillingUrl(response.url, "checkout");
      if (
        response.livemode !== binding.livemode ||
        response.mode !== "subscription" ||
        providerId(response.customer) !== facts.customer.providerId ||
        response.metadata?.billing_intent_id !== claimed.id ||
        response.expires_at !== (claimed.parameters.expires_at as number) ||
        !hostedUrl
      )
        throw new SellerError("NOT_AVAILABLE");
    } else if (claimed.operation === "cancel") {
      const response = await stripe.subscriptions.update(
        claimed.subscriptionId!,
        { cancel_at_period_end: true },
        options,
      );
      providerObjectId = response.id;
      if (
        response.id !== claimed.subscriptionId ||
        !response.cancel_at_period_end
      )
        throw new SellerError("NOT_AVAILABLE");
    } else if (claimed.operation === "preview") {
      const response = await stripe.invoices.createPreview(
        claimed.parameters as Stripe.InvoiceCreatePreviewParams,
        options,
      );
      if (
        response.currency !== "eur" ||
        !Number.isSafeInteger(response.amount_due)
      )
        throw new SellerError("NOT_AVAILABLE");
      const details = claimed.parameters.subscription_details;
      const prorationDate =
        details && typeof details === "object" && "proration_date" in details
          ? details.proration_date
          : undefined;
      if (
        typeof prorationDate !== "number" ||
        !Number.isSafeInteger(prorationDate) ||
        prorationDate < 1
      )
        throw new SellerError("NOT_AVAILABLE");
      providerObjectId = response.id;
      result = {
        ...invoiceReview(response),
        amountMinor: response.amount_due,
        currency: "EUR",
        prorationDate,
        previousPrice: claimed.expectedPriceId,
        subscriptionHash: subscriptionReview(reviewedSubscription!),
        monthlyAmountMinor: facts.plan.amountMinor,
        termsVersion: facts.plan.termsVersion,
      };
      result.reviewHash = inputHash({
        ...result,
        catalogueId: claimed.catalogueId,
        subscriptionId: claimed.subscriptionId,
      });
    } else if (claimed.operation === "change") {
      const response = await stripe.subscriptions.update(
        claimed.subscriptionId!,
        claimed.parameters as Stripe.SubscriptionUpdateParams,
        options,
      );
      providerObjectId = response.id;
      if (
        response.id !== claimed.subscriptionId ||
        providerId(response.customer) !== facts.customer.providerId ||
        response.livemode !== binding.livemode
      )
        throw new SellerError("NOT_AVAILABLE");
      const invoiceId = providerId(response.latest_invoice);
      if (!invoiceId) throw new SellerError("NOT_AVAILABLE");
      const invoice = await stripe.invoices.retrieve(invoiceId);
      if (
        !matchingChangeInvoice(
          invoice,
          facts.customer.providerId,
          response.id,
          binding.livemode,
        )
      )
        throw new SellerError("CONFLICT");
      changeInvoiceId = invoice.id;
      hostedUrl = safeBillingUrl(invoice.hosted_invoice_url, "invoice");
      result = claimed.result; // Exact immutable accepted quote, never a new browser estimate.
    } else {
      const response = await stripe.billingPortal.sessions.create(
        claimed.parameters as Stripe.BillingPortal.SessionCreateParams,
        options,
      );
      providerObjectId = response.id;
      hostedUrl = safeBillingUrl(response.url, "portal");
      if (response.customer !== facts.customer.providerId || !hostedUrl)
        throw new SellerError("NOT_AVAILABLE");
    }
    await inTransaction(database, async (tx) => {
      await lockUsage(tx, claimed.sellerId);
      await tx.client.query(
        `UPDATE treido.billing_intents SET provider_id=COALESCE(provider_id,$2),hosted_url=COALESCE(hosted_url,$3),result=COALESCE(result,$4),state=$5,change_invoice_id=COALESCE(change_invoice_id,$6),updated_at=clock_timestamp() WHERE id=$1 AND state IN ('creating','reconciling')`,
        [
          claimed.id,
          providerObjectId,
          hostedUrl,
          result,
          claimed.operation === "cancel" ? "complete" : "ready",
          changeInvoiceId,
        ],
      );
      await enqueueBillingObservation(tx, claimed);
    });
  } catch {
    await inTransaction(database, async (tx) => {
      await lockUsage(tx, claimed.sellerId);
      await tx.client.query(
        `UPDATE treido.billing_intents SET state='reconciling',updated_at=clock_timestamp() WHERE id=$1 AND state='creating'`,
        [claimed.id],
      );
      await enqueueBillingObservation(tx, claimed);
    });
  }
  return recoverBillingIntent(
    database,
    identity,
    prepared.sellerId,
    prepared.requestId,
    libraryActorKey(identity),
  );
}
export function currentBillingBinding() {
  return paymentBindings();
}
