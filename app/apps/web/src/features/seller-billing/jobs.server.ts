import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type {
  EffectContext,
  EffectResult,
} from "../../server/jobs/execution.server";
import {
  paymentBindings,
  verifiedStripe,
  type PaymentBindings,
} from "../payments/bindings.server";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import { validId } from "../selling/draft-model";
import { safeBillingUrl } from "./model";
import { capturedChargeMatches } from "./payment-evidence";
import {
  billingStorageReady,
  catalogueColumns,
  checkedCatalogue,
  type CatalogueRow,
} from "./storage.server";
import { BILLING_EVENTS, providerId } from "./provider.server";
import {
  enqueueBillingObservation,
  intentColumns,
  type BillingIntent,
} from "./commands.server";

/** Correlation only, inside the sole raw-body signed receipt transaction. */
export async function receiveBillingEvent(
  tx: SellerTransaction,
  event: Stripe.Event,
  binding: PaymentBindings,
) {
  if (!BILLING_EVENTS.includes(event.type) || !(await billingStorageReady(tx)))
    return false;
  const object = event.data.object as unknown as {
    id?: unknown;
    subscription?: unknown;
    payment_intent?: unknown;
    charge?: unknown;
    metadata?: Record<string, unknown>;
    parent?: {
      subscription_details?: {
        subscription?: unknown;
        metadata?: Record<string, unknown>;
      };
    };
  };
  const metadata =
    object.metadata?.purpose === "seller_subscription"
      ? object.metadata
      : object.parent?.subscription_details?.metadata;
  const intentId = validId(metadata?.billing_intent_id)
      ? metadata!.billing_intent_id
      : null,
    subId = event.type.startsWith("customer.subscription.")
      ? providerId(object.id)
      : (providerId(object.subscription) ??
        providerId(object.parent?.subscription_details?.subscription));
  const chargeId = event.type.startsWith("charge.")
      ? providerId(object.id)
      : providerId(object.charge),
    intentSignal = providerId(object.payment_intent);
  const rows = (
    await tx.client.query<{ id: string; sellerId: string }>(
      `SELECT DISTINCT i.id,i.seller_id AS "sellerId" FROM treido.billing_intents i
    JOIN treido.billing_customers b ON b.id=i.customer_binding_id LEFT JOIN treido.billing_subscriptions s ON s.origin_intent_id=i.id LEFT JOIN treido.billing_payment_links l ON l.subscription_id=s.id
    WHERE b.platform_account=$1 AND b.livemode=$2 AND b.environment=$3 AND b.application_id=$4 AND b.purpose='seller_subscription'
    AND (($5::uuid IS NOT NULL AND i.id=$5) OR ($6::text IS NOT NULL AND s.provider_id=$6) OR ($7::text IS NOT NULL AND l.charge_id=$7) OR ($8::text IS NOT NULL AND l.payment_intent_id=$8)) LIMIT 2`,
      [
        binding.platformAccount,
        binding.livemode,
        binding.environment,
        binding.applicationId,
        intentId,
        subId,
        chargeId,
        intentSignal,
      ],
    )
  ).rows;
  if (rows.length > 1) throw new SellerError("CONFLICT");
  if (!rows[0]) return false;
  const hash = createHash("sha256")
      .update(
        "seller_subscription:" +
          binding.platformAccount +
          ":" +
          binding.livemode +
          ":" +
          event.id,
      )
      .digest("hex"),
    operation =
      hash.slice(0, 8) +
      "-" +
      hash.slice(8, 12) +
      "-4" +
      hash.slice(13, 16) +
      "-8" +
      hash.slice(17, 20) +
      "-" +
      hash.slice(20, 32);
  await enqueueBillingObservation(tx, rows[0], operation);
  return true;
}
type InvoiceFact = {
  id: string;
  status: string;
  amountMinor: number;
  url: string | null;
  paid: boolean;
  reversed: boolean;
  payments: { chargeId: string; intentId: string | null }[];
  intervals: { lineId: string; start: number; end: number }[];
  hash: string;
};
async function invoiceFact(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  sub: Stripe.Subscription,
  plan: CatalogueRow,
  customerId: string,
  binding: PaymentBindings,
): Promise<InvoiceFact> {
  if (
    invoice.livemode !== binding.livemode ||
    providerId(invoice.customer) !== customerId ||
    invoice.currency !== "eur" ||
    providerId(invoice.parent?.subscription_details?.subscription) !== sub.id ||
    !Number.isSafeInteger(invoice.total) ||
    invoice.total < 0
  )
    throw new SellerError("CONFLICT");
  const reversed =
    invoice.status === "void" ||
    invoice.status === "uncollectible" ||
    invoice.post_payment_credit_notes_amount > 0;
  let paid =
    !reversed &&
    invoice.status === "paid" &&
    invoice.collection_method === "charge_automatically" &&
    invoice.total > 0 &&
    invoice.amount_paid >= invoice.total &&
    invoice.amount_remaining === 0;
  let paymentReversed = false;
  const paymentLinks: InvoiceFact["payments"] = [];
  if (paid) {
    const payments = await stripe.invoicePayments.list({
      invoice: invoice.id,
      limit: 100,
    });
    if (payments.has_more) paid = false;
    let amount = 0;
    for (const payment of payments.data) {
      if (payment.status !== "paid") continue;
      if (
        payment.livemode !== binding.livemode ||
        providerId(payment.invoice) !== invoice.id ||
        payment.currency !== "eur"
      )
        throw new SellerError("CONFLICT");
      let charge: Stripe.Charge | null = null;
      let expectedChargeId: string | null = null;
      let expectedIntentId: string | undefined;
      let expectedAmount = 0;
      if (payment.payment.type === "payment_intent") {
        const id = providerId(payment.payment.payment_intent);
        if (id) {
          const intent = await stripe.paymentIntents.retrieve(id);
          if (
            intent.id !== id ||
            intent.status !== "succeeded" ||
            !Number.isSafeInteger(intent.amount) ||
            intent.amount < 1 ||
            intent.amount_received !== intent.amount ||
            intent.livemode !== binding.livemode ||
            providerId(intent.customer) !== customerId ||
            intent.currency !== "eur"
          )
            throw new SellerError("CONFLICT");
          expectedIntentId = id;
          expectedAmount = intent.amount;
          expectedChargeId = providerId(intent.latest_charge);
          if (expectedChargeId)
            charge = await stripe.charges.retrieve(expectedChargeId);
        }
      } else if (payment.payment.type === "charge") {
        const id = providerId(payment.payment.charge);
        if (id) {
          expectedChargeId = id;
          charge = await stripe.charges.retrieve(id);
          expectedAmount = charge.amount;
        }
      }
      if (
        !charge ||
        !expectedChargeId ||
        !capturedChargeMatches(charge, {
          chargeId: expectedChargeId,
          customerId,
          ...(expectedIntentId ? { paymentIntentId: expectedIntentId } : {}),
          livemode: binding.livemode,
          amountMinor: expectedAmount,
        })
      ) {
        paid = false;
        continue;
      }
      paymentLinks.push({
        chargeId: charge.id,
        intentId: providerId(charge.payment_intent),
      });
      if (charge.amount_refunded > 0 || charge.disputed) paymentReversed = true;
      const allocatedMinor = payment.amount_paid;
      if (
        paymentReversed ||
        allocatedMinor == null ||
        !Number.isSafeInteger(allocatedMinor) ||
        allocatedMinor < 1 ||
        allocatedMinor > charge.amount_captured
      ) {
        paid = false;
        continue;
      }
      amount += allocatedMinor;
    }
    if (amount < invoice.amount_paid) paid = false;
  }
  const intervals: InvoiceFact["intervals"] = [];
  if (paid) {
    const lines = await stripe.invoices.listLineItems(invoice.id, {
      limit: 100,
    });
    if (lines.has_more) paid = false;
    for (const line of lines.data) {
      const price = providerId(line.pricing?.price_details?.price),
        parent = line.parent?.subscription_item_details;
      if (line.livemode !== binding.livemode || line.currency !== "eur")
        throw new SellerError("CONFLICT");
      if (
        price !== plan.priceId ||
        !parent ||
        providerId(parent.subscription) !== sub.id ||
        parent.subscription_item !== sub.items.data[0].id ||
        line.quantity !== 1 ||
        line.amount <= 0 ||
        (!parent.proration && line.amount !== plan.amountMinor) ||
        !Number.isSafeInteger(line.period.start) ||
        !Number.isSafeInteger(line.period.end) ||
        line.period.start >= line.period.end ||
        line.period.end > sub.items.data[0].current_period_end
      )
        continue;
      intervals.push({
        lineId: line.id,
        start: line.period.start,
        end: line.period.end,
      });
    }
  }
  const fact = {
    id: invoice.id,
    status: invoice.status ?? "unknown",
    amountMinor: invoice.total,
    url: safeBillingUrl(invoice.hosted_invoice_url, "invoice"),
    paid: paid && !paymentReversed,
    reversed: reversed || paymentReversed,
    payments: paymentLinks,
    intervals: paid && !paymentReversed ? intervals : [],
  };
  return { ...fact, hash: inputHash(fact) };
}
/** Provider READS only. No POST replay, new key, recovery URL, charge or changed hold. */
export async function processBillingObservation(
  database: SellerDatabase,
  job: EffectContext,
): Promise<EffectResult> {
  if (
    job.kind !== "billing.reconcile" ||
    job.authority !== "service" ||
    !validId(job.resourceId) ||
    !validId(job.sellerId)
  )
    throw new SellerError("FORBIDDEN");
  const binding = paymentBindings();
  const source = await inTransaction(database, async (tx) => {
    if (!(await billingStorageReady(tx)))
      throw new SellerError("NOT_AVAILABLE");
    await tx.client.query(
      "SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR UPDATE",
      [job.sellerId],
    );
    const row = (
      await tx.client.query<BillingIntent>(
        `SELECT ${intentColumns} FROM treido.billing_intents WHERE id=$1 AND seller_id=$2 FOR UPDATE`,
        [job.resourceId, job.sellerId],
      )
    ).rows[0];
    if (!row || row.parameterHash !== inputHash(row.parameters))
      throw new SellerError("CONFLICT");
    const customer = (
      await tx.client.query<{
        id: string;
        providerId: string;
        kind: "personal" | "business";
      }>(
        `SELECT b.id,b.provider_id AS "providerId",s.kind FROM treido.billing_customers b JOIN treido.seller_accounts s ON s.id=b.seller_id WHERE b.id=$1 AND b.seller_id=$2 AND b.platform_account=$3 AND b.livemode=$4 AND b.environment=$5 AND b.application_id=$6 AND b.purpose='seller_subscription'`,
        [
          row.customerBindingId,
          row.sellerId,
          binding.platformAccount,
          binding.livemode,
          binding.environment,
          binding.applicationId,
        ],
      )
    ).rows[0];
    if (!customer) throw new SellerError("CONFLICT");
    await tx.client.query(
      "INSERT INTO treido.billing_sync(customer_binding_id,seller_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [customer.id, row.sellerId],
    );
    const sync = (
      await tx.client.query<{ generation: number }>(
        "UPDATE treido.billing_sync SET generation=generation+1 WHERE customer_binding_id=$1 AND seller_id=$2 RETURNING generation",
        [customer.id, row.sellerId],
      )
    ).rows[0];
    const subscription =
      (
        await tx.client.query<{
          id: string;
          providerId: string;
          generation: number;
          retiredAt: Date | null;
        }>(
          `UPDATE treido.billing_subscriptions SET generation=generation+1 WHERE customer_binding_id=$1 AND (origin_intent_id=$2 OR provider_id=$3) RETURNING id,provider_id AS "providerId",generation,retired_at AS "retiredAt"`,
          [customer.id, row.id, row.subscriptionId],
        )
      ).rows.at(0) ?? null;
    return { row, customer, subscription, sync };
  });
  const stripe = await verifiedStripe(binding);
  let session: Stripe.Checkout.Session | null = null,
    subscriptionId =
      source.subscription?.providerId ?? source.row.subscriptionId;
  if (source.row.operation === "checkout") {
    if (source.row.providerId)
      session = await stripe.checkout.sessions.retrieve(source.row.providerId);
    else if (["creating", "reconciling"].includes(source.row.state)) {
      const list = await stripe.checkout.sessions.list({
        customer: source.customer.providerId,
        limit: 100,
      });
      if (list.has_more) throw new SellerError("NOT_AVAILABLE");
      const matches = list.data.filter(
        (s) => s.metadata?.billing_intent_id === source.row.id,
      );
      if (matches.length > 1) throw new SellerError("CONFLICT");
      session = matches[0] ?? null;
    }
    if (session) {
      const m = session.metadata;
      if (
        session.livemode !== binding.livemode ||
        session.mode !== "subscription" ||
        providerId(session.customer) !== source.customer.providerId ||
        session.client_reference_id !== source.row.id ||
        m?.purpose !== "seller_subscription" ||
        m.application_id !== binding.applicationId ||
        m.environment !== binding.environment ||
        m.seller_id !== source.row.sellerId ||
        m.billing_intent_id !== source.row.id ||
        m.catalogue_id !== source.row.catalogueId ||
        session.expires_at !== source.row.parameters.expires_at
      )
        throw new SellerError("CONFLICT");
      const lines = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 2,
      });
      const expected = (
        source.row.parameters as unknown as Stripe.Checkout.SessionCreateParams
      ).line_items?.[0]?.price;
      if (
        lines.has_more ||
        lines.data.length !== 1 ||
        lines.data[0].price?.id !== expected ||
        lines.data[0].quantity !== 1
      )
        throw new SellerError("CONFLICT");
      subscriptionId = providerId(session.subscription);
    }
  }
  if (!subscriptionId)
    return {
      resultId: source.row.id,
      providerObjectId: session?.id,
      lock: (tx) => lockBillingUsage(tx, job.sellerId),
      apply: async (tx) => {
        const sync = (
          await tx.client.query<{ generation: number }>(
            "SELECT generation FROM treido.billing_sync WHERE customer_binding_id=$1 AND seller_id=$2 FOR UPDATE",
            [source.customer.id, source.row.sellerId],
          )
        ).rows[0];
        if (!sync || sync.generation !== source.sync.generation) return;
        if (session)
          await tx.client.query(
            `UPDATE treido.billing_intents SET provider_id=COALESCE(provider_id,$2),hosted_url=COALESCE(hosted_url,$3),state=$4,updated_at=clock_timestamp() WHERE id=$1 AND state IN ('prepared','creating','reconciling','ready')`,
            [
              source.row.id,
              session.id,
              safeBillingUrl(session.url, "checkout"),
              session.status === "expired" ? "expired" : "ready",
            ],
          );
      },
    };
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const m = sub.metadata;
  if (
    sub.livemode !== binding.livemode ||
    providerId(sub.customer) !== source.customer.providerId ||
    m.purpose !== "seller_subscription" ||
    m.seller_id !== source.row.sellerId ||
    m.application_id !== binding.applicationId ||
    m.environment !== binding.environment ||
    !validId(m.billing_intent_id) ||
    sub.items.has_more ||
    sub.items.data.length !== 1 ||
    sub.items.data[0].quantity !== 1 ||
    sub.collection_method !== "charge_automatically" ||
    sub.trial_end ||
    sub.schedule
  )
    throw new SellerError("CONFLICT");
  const mapped = await inTransaction(database, async (tx) => {
    const origin = (
      await tx.client.query<{ id: string }>(
        `SELECT id FROM treido.billing_intents WHERE id=$1 AND operation='checkout' AND seller_id=$2 AND customer_binding_id=$3`,
        [m.billing_intent_id, source.row.sellerId, source.customer.id],
      )
    ).rows[0];
    if (
      !origin ||
      (source.row.operation === "checkout" && origin.id !== source.row.id)
    )
      throw new SellerError("CONFLICT");
    const plan = checkedCatalogue(
      (
        await tx.client.query<CatalogueRow>(
          `SELECT ${catalogueColumns} FROM treido.billing_catalogue WHERE price_id=$1 AND platform_account=$2 AND livemode=$3 AND environment=$4 AND application_id=$5 AND purpose='seller_subscription'`,
          [
            sub.items.data[0].price.id,
            binding.platformAccount,
            binding.livemode,
            binding.environment,
            binding.applicationId,
          ],
        )
      ).rows[0],
      source.customer.kind,
    );
    const existing = (
      await tx.client.query<{
        id: string;
        generation: number;
        retiredAt: Date | null;
      }>(
        `SELECT id,generation,retired_at AS "retiredAt" FROM treido.billing_subscriptions WHERE customer_binding_id=$1 AND provider_id=$2`,
        [source.customer.id, sub.id],
      )
    ).rows[0];
    const activeInvoices = existing
      ? (
          await tx.client.query<{ id: string }>(
            `SELECT DISTINCT invoice_id AS id FROM treido.billing_paid_intervals i WHERE subscription_id=$1 AND ends_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM treido.billing_revocations r WHERE r.subscription_id=i.subscription_id AND r.invoice_id=i.invoice_id) LIMIT 21`,
            [existing.id],
          )
        ).rows.map((x) => x.id)
      : [];
    if (activeInvoices.length > 20) throw new SellerError("NOT_AVAILABLE");
    return { originId: origin.id, plan, existing, activeInvoices };
  });
  const latest = await stripe.invoices.list({
    subscription: sub.id,
    limit: 20,
  });
  const invoices = new Map(latest.data.map((x) => [x.id, x]));
  for (const id of mapped.activeInvoices)
    if (!invoices.has(id)) invoices.set(id, await stripe.invoices.retrieve(id));
  const facts: InvoiceFact[] = [];
  for (const invoice of invoices.values())
    facts.push(
      await invoiceFact(
        stripe,
        invoice,
        sub,
        mapped.plan,
        source.customer.providerId,
        binding,
      ),
    );
  return {
    resultId: source.row.id,
    providerObjectId: sub.id,
    lock: (tx) => lockBillingUsage(tx, job.sellerId),
    apply: async (tx) => {
      const sync = (
        await tx.client.query<{ generation: number }>(
          "SELECT generation FROM treido.billing_sync WHERE customer_binding_id=$1 AND seller_id=$2 FOR UPDATE",
          [source.customer.id, source.row.sellerId],
        )
      ).rows[0];
      if (!sync || sync.generation !== source.sync.generation) return;
      const current = (
        await tx.client.query<{
          id: string;
          generation: number;
          retiredAt: Date | null;
        }>(
          `SELECT id,generation,retired_at AS "retiredAt" FROM treido.billing_subscriptions WHERE customer_binding_id=$1 AND provider_id=$2 FOR UPDATE`,
          [source.customer.id, sub.id],
        )
      ).rows[0];
      if (
        source.subscription &&
        (!current ||
          current.id !== source.subscription.id ||
          current.generation !== source.subscription.generation)
      )
        return;
      // A permanently retired subscription cannot be revived by any delayed observation.
      if (current?.retiredAt) return;
      const id = current?.id ?? randomUUID(),
        terminal = ["canceled", "incomplete_expired"].includes(sub.status),
        state =
          sub.pause_collection || sub.pending_update
            ? "reconciling"
            : sub.status;
      if (!current)
        await tx.client.query(
          `INSERT INTO treido.billing_subscriptions(id,seller_id,customer_binding_id,provider_id,origin_intent_id,catalogue_id,item_id,state,cancel_at_period_end,period_end,retired_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,to_timestamp($10),CASE WHEN $11 THEN clock_timestamp() ELSE NULL END)`,
          [
            id,
            source.row.sellerId,
            source.customer.id,
            sub.id,
            mapped.originId,
            mapped.plan.id,
            sub.items.data[0].id,
            state,
            sub.cancel_at_period_end,
            sub.items.data[0].current_period_end,
            terminal,
          ],
        );
      else
        await tx.client.query(
          `UPDATE treido.billing_subscriptions SET catalogue_id=$2,item_id=$3,state=$4,cancel_at_period_end=$5,period_end=to_timestamp($6),observed_at=clock_timestamp(),retired_at=CASE WHEN $7 THEN clock_timestamp() ELSE retired_at END WHERE id=$1`,
          [
            id,
            mapped.plan.id,
            sub.items.data[0].id,
            state,
            sub.cancel_at_period_end,
            sub.items.data[0].current_period_end,
            terminal,
          ],
        );
      for (const fact of facts) {
        for (const payment of fact.payments)
          await tx.client.query(
            "INSERT INTO treido.billing_payment_links(subscription_id,invoice_id,charge_id,payment_intent_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
            [id, fact.id, payment.chargeId, payment.intentId],
          );
        await tx.client.query(
          `INSERT INTO treido.billing_invoice_observations(id,subscription_id,provider_id,fact_hash,status,amount_minor,currency,hosted_url,paid) VALUES($1,$2,$3,$4,$5,$6,'EUR',$7,$8) ON CONFLICT DO NOTHING`,
          [
            randomUUID(),
            id,
            fact.id,
            fact.hash,
            fact.status,
            fact.amountMinor,
            fact.url,
            fact.paid,
          ],
        );
        if (fact.reversed)
          await tx.client.query(
            `INSERT INTO treido.billing_revocations(subscription_id,invoice_id,reason) VALUES($1,$2,'reversed') ON CONFLICT DO NOTHING`,
            [id, fact.id],
          );
        for (const interval of fact.intervals)
          await tx.client.query(
            `INSERT INTO treido.billing_paid_intervals(id,subscription_id,catalogue_id,invoice_id,line_id,starts_at,ends_at,evidence_hash) VALUES($1,$2,$3,$4,$5,to_timestamp($6),to_timestamp($7),$8) ON CONFLICT DO NOTHING`,
            [
              randomUUID(),
              id,
              mapped.plan.id,
              fact.id,
              interval.lineId,
              interval.start,
              interval.end,
              fact.hash,
            ],
          );
      }
      if (
        (source.row.operation === "checkout" &&
          session?.status === "complete") ||
        (source.row.operation === "cancel" && sub.cancel_at_period_end) ||
        (source.row.operation === "change" &&
          mapped.plan.id === source.row.catalogueId)
      )
        await tx.client.query(
          `UPDATE treido.billing_intents SET state='complete',provider_id=COALESCE(provider_id,$2),updated_at=clock_timestamp() WHERE id=$1 AND state IN ('creating','reconciling','ready')`,
          [
            source.row.id,
            source.row.operation === "checkout" ? (session?.id ?? null) : null,
          ],
        );
    },
  };
}
async function lockBillingUsage(tx: SellerTransaction, sellerId: string) {
  await tx.client.query(
    "SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR UPDATE",
    [sellerId],
  );
}
export async function scheduleBillingRepair(database: SellerDatabase) {
  return inTransaction(database, async (tx) => {
    if (!(await billingStorageReady(tx))) return 0;
    await tx.client.query(
      "UPDATE treido.billing_intents SET state='expired',updated_at=clock_timestamp() WHERE state='prepared' AND first_attempt_at IS NULL AND expires_at<=clock_timestamp()",
    );
    const rows = (
      await tx.client.query<{
        id: string;
        sellerId: string;
      }>(`SELECT DISTINCT i.id,i.seller_id AS "sellerId" FROM treido.billing_intents i LEFT JOIN treido.billing_subscriptions s ON s.origin_intent_id=i.id
      WHERE (i.state IN ('creating','reconciling','ready') AND i.operation IN ('checkout','cancel','change') OR s.retired_at IS NULL AND s.id IS NOT NULL)
      AND i.updated_at<clock_timestamp()-interval '60 seconds'
      AND NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='billing.reconcile' AND j.resource_id=i.id AND j.state IN ('pending','accepted'))
      ORDER BY i.id LIMIT 20`)
    ).rows;
    for (const row of rows) await enqueueBillingObservation(tx, row);
    return rows.length;
  });
}
