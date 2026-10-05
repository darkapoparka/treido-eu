import "server-only";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type {
  EffectContext,
  EffectResult,
} from "../../server/jobs/execution.server";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { lockAllocation } from "../inventory/allocations.server";
import { paymentBindings, verifiedStripe } from "./bindings.server";
import {
  attemptColumns,
  assertAttemptScope,
  enqueuePaymentObservation,
  type AttemptRow,
  verifyPaymentIntent,
} from "./attempts.server";
import {
  appendFacts,
  applyPaymentObservation,
  paymentFacts,
  type ProviderFact,
} from "./settlement.server";

export async function processPaymentObservation(
  database: SellerDatabase,
  job: EffectContext,
): Promise<EffectResult> {
  if (job.kind !== "payment.reconcile" || job.authority !== "service")
    throw new SellerError("FORBIDDEN");
  const row = (
    await database.pool.query<AttemptRow>(
      `SELECT ${attemptColumns} FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE a.id=$1 AND a.seller_id=$2`,
      [job.resourceId, job.sellerId],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  const binding = paymentBindings();
  assertAttemptScope(row, binding);
  const stripe = await verifiedStripe(binding);
  let intent: Stripe.PaymentIntent | null = null;
  if (row.providerId)
    intent = await stripe.paymentIntents.retrieve(row.providerId);
  else {
    const found = await stripe.paymentIntents.search({
      query: `metadata['attempt_id']:'${row.id}' AND metadata['application_id']:'${binding.applicationId}' AND metadata['environment']:'${binding.environment}'`,
      limit: 2,
    });
    if (found.has_more || found.data.length > 1) {
      return {
        resultId: row.id,
        lock: async (tx) => {
          await lockAllocation(tx, row.allocationId);
        },
        apply: async (tx) => {
          await tx.client.query(
            `UPDATE treido.payment_attempts SET state='quarantined',reconcile_at=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
            [row.id],
          );
        },
      };
    }
    intent = found.data[0] ?? null;
    // Search is eventually consistent. An empty result NEVER permits another POST.
    if (intent) intent = await stripe.paymentIntents.retrieve(intent.id);
  }
  if (intent) {
    verifyPaymentIntent(row, intent, binding);
    if (
      (row.cancelRequested || row.expiresAt.getTime() <= Date.now()) &&
      !["succeeded", "canceled"].includes(intent.status)
    ) {
      try {
        intent = await stripe.paymentIntents.cancel(
          intent.id,
          { cancellation_reason: "abandoned" },
          { idempotencyKey: row.cancelKey },
        );
      } catch {
        intent = await stripe.paymentIntents.retrieve(intent.id);
      }
      verifyPaymentIntent(row, intent, binding);
    }
  }
  const observation = intent ? await paymentFacts(stripe, row, intent) : null;
  return {
    resultId: row.id,
    ...(intent ? { providerObjectId: intent.id } : {}),
    lock: async (tx) => {
      await lockAllocation(tx, row.allocationId);
    },
    apply: (tx) =>
      applyPaymentObservation(tx, row, intent, binding, observation),
  };
}
type RefundRow = {
  id: string;
  orderId: string;
  attemptId: string;
  sellerId: string;
  actorId: string;
  state:
    | "prepared"
    | "creating"
    | "reconciling"
    | "pending"
    | "succeeded"
    | "failed";
  providerId: string | null;
  operationKey: string;
  parameters: Stripe.RefundCreateParams;
  parameterHash: string;
};
export async function processPaymentRefund(
  database: SellerDatabase,
  job: EffectContext,
): Promise<EffectResult> {
  if (job.kind !== "payment.refund" || job.authority !== "service")
    throw new SellerError("FORBIDDEN");
  const binding = paymentBindings();
  const stripe = await verifiedStripe(binding);
  const prepared = await inTransaction(database, async (tx) => {
    const initial = (
      await tx.client.query<RefundRow>(
        `SELECT id,order_id AS "orderId",attempt_id AS "attemptId",seller_id AS "sellerId",actor_id AS "actorId",state,provider_id AS "providerId",operation_key AS "operationKey",parameters,parameter_hash AS "parameterHash" FROM treido.payment_refunds WHERE id=$1 AND seller_id=$2`,
        [job.resourceId, job.sellerId],
      )
    ).rows[0];
    if (!initial) throw new SellerError("NOT_FOUND");
    const attempt = (
      await tx.client.query<AttemptRow>(
        `SELECT ${attemptColumns} FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE a.id=$1`,
        [initial.attemptId],
      )
    ).rows[0];
    assertAttemptScope(attempt, binding);
    await lockAllocation(tx, attempt.allocationId);
    const row = (
      await tx.client.query<RefundRow>(
        `SELECT id,order_id AS "orderId",attempt_id AS "attemptId",seller_id AS "sellerId",actor_id AS "actorId",state,provider_id AS "providerId",operation_key AS "operationKey",parameters,parameter_hash AS "parameterHash" FROM treido.payment_refunds WHERE id=$1 FOR UPDATE`,
        [initial.id],
      )
    ).rows[0];
    if (
      inputHash(row.parameters) !== row.parameterHash ||
      !row.parameters.metadata ||
      typeof row.parameters.metadata !== "object" ||
      row.parameters.metadata.refund_id !== row.id ||
      row.parameters.metadata.attempt_id !== attempt.id ||
      row.parameters.amount !== attempt.totalMinor ||
      row.parameters.payment_intent !== attempt.providerId ||
      row.parameters.reverse_transfer !== true ||
      row.parameters.refund_application_fee !== attempt.applicationFeeMinor > 0
    )
      throw new SellerError("CONFLICT");
    let create = false;
    if (row.state === "prepared") {
      const human = (
        await tx.client.query<{ subject: string }>(
          `SELECT clerk_subject AS subject FROM treido.users WHERE id=$1 AND status='active'`,
          [row.actorId],
        )
      ).rows[0];
      if (!human) throw new SellerError("FORBIDDEN");
      // Recent authentication was verified at the durable human command. Jobs
      // recheck current membership; synthetic identities do not claim recency.
      await authorizeSeller(
        tx,
        { subject: human.subject },
        row.sellerId,
        "refund.request",
      );
      await tx.client.query(
        `UPDATE treido.payment_refunds SET state='creating',first_attempt_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1`,
        [row.id],
      );
      create = true;
    }
    return { row, attempt, create };
  });
  let refund: Stripe.Refund | null = null;
  if (prepared.create) {
    try {
      refund = await stripe.refunds.create(prepared.row.parameters, {
        idempotencyKey: prepared.row.operationKey,
      });
    } catch {
      await database.pool.query(
        `UPDATE treido.payment_refunds SET state='reconciling',reconcile_at=clock_timestamp()+interval '1 minute' WHERE id=$1 AND state='creating'`,
        [prepared.row.id],
      );
    }
  } else if (prepared.row.providerId)
    refund = await stripe.refunds.retrieve(prepared.row.providerId);
  else if (prepared.row.state !== "prepared") {
    // Refund listing is scoped to the original intent. Traverse all pages; a
    // missing/multiple match stays reconciling and never creates another refund.
    const matches: Stripe.Refund[] = [];
    for await (const candidate of stripe.refunds.list({
      payment_intent: prepared.attempt.providerId!,
      limit: 100,
    })) {
      if (candidate.metadata?.refund_id === prepared.row.id)
        matches.push(candidate);
      if (matches.length > 1) break;
    }
    if (matches.length === 1)
      refund = await stripe.refunds.retrieve(matches[0].id);
  }
  const facts: ProviderFact[] = [];
  let reversalVerified = false,
    feeVerified = prepared.attempt.applicationFeeMinor === 0;
  if (refund) {
    if (
      refund.amount !== prepared.attempt.totalMinor ||
      refund.currency !== "eur" ||
      refund.payment_intent !== prepared.attempt.providerId ||
      refund.metadata?.refund_id !== prepared.row.id ||
      refund.metadata?.attempt_id !== prepared.attempt.id ||
      refund.metadata?.application_id !== binding.applicationId ||
      refund.metadata?.environment !== binding.environment
    )
      throw new SellerError("CONFLICT");
    if (refund.status === "succeeded") {
      facts.push({
        kind: "refund",
        objectId: refund.id,
        amountMinor: refund.amount,
        currency: refund.currency,
      });
      const reversalId =
        typeof refund.transfer_reversal === "string"
          ? refund.transfer_reversal
          : refund.transfer_reversal?.id;
      const transferFact = (
        await database.pool.query<{ id: string }>(
          `SELECT object_id AS id FROM treido.payment_facts WHERE attempt_id=$1 AND kind='transfer'`,
          [prepared.attempt.id],
        )
      ).rows[0];
      if (reversalId && transferFact) {
        const reversal = await stripe.transfers.retrieveReversal(
          transferFact.id,
          reversalId,
        );
        reversalVerified =
          reversal.amount === prepared.attempt.totalMinor &&
          reversal.currency === "eur" &&
          (typeof reversal.source_refund === "string"
            ? reversal.source_refund
            : reversal.source_refund?.id) === refund.id;
        if (reversalVerified)
          facts.push({
            kind: "transfer_reversal",
            objectId: reversal.id,
            amountMinor: reversal.amount,
            currency: reversal.currency,
          });
      }
      const feeFact = (
        await database.pool.query<{ id: string }>(
          `SELECT object_id AS id FROM treido.payment_facts WHERE attempt_id=$1 AND kind='application_fee'`,
          [prepared.attempt.id],
        )
      ).rows[0];
      if (feeFact) {
        const fee = await stripe.applicationFees.retrieve(feeFact.id);
        const feeRefunds = await stripe.applicationFees.listRefunds(fee.id, {
          limit: 100,
        });
        // Full refund is the only allowed refund for this order; all provider
        // fee refunds are recorded separately from the payment refund/reversal.
        feeVerified =
          fee.amount_refunded === prepared.attempt.applicationFeeMinor &&
          !feeRefunds.has_more;
        if (feeVerified)
          for (const item of feeRefunds.data)
            facts.push({
              kind: "fee_refund",
              objectId: item.id,
              amountMinor: item.amount,
              currency: item.currency,
            });
      }
    }
  }
  const observed = refund;
  return {
    resultId: prepared.row.id,
    ...(observed ? { providerObjectId: observed.id } : {}),
    lock: async (tx) => {
      await lockAllocation(tx, prepared.attempt.allocationId);
    },
    apply: async (tx) => {
      await tx.client.query(
        `SELECT id FROM treido.payment_refunds WHERE id=$1 FOR UPDATE`,
        [prepared.row.id],
      );
      await appendFacts(tx, prepared.attempt, facts);
      const complete =
        observed?.status === "succeeded" && reversalVerified && feeVerified;
      const state = complete
        ? "succeeded"
        : observed?.status === "failed" || observed?.status === "canceled"
          ? "failed"
          : observed?.status === "pending"
            ? "pending"
            : "reconciling";
      await tx.client.query(
        `UPDATE treido.payment_refunds SET provider_id=coalesce(provider_id,$2),state=$3,reconcile_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() WHERE id=$1 AND (provider_id IS NULL OR provider_id=$2)`,
        [prepared.row.id, observed?.id ?? null, state],
      );
      await tx.client.query(
        `UPDATE treido.paid_orders SET payment_state=$2,settlement_state=CASE WHEN $3 THEN 'reversed' ELSE 'reconciliation' END,fulfilment_state='blocked',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 AND (payment_state<>$2 OR ($3 AND settlement_state<>'reversed'))`,
        [
          prepared.row.orderId,
          complete
            ? "refunded"
            : state === "failed"
              ? "reconciliation"
              : "refund_pending",
          complete,
        ],
      );
    },
  };
}
/** The signed repair job schedules observation only; it never creates a charge. */
export async function schedulePaymentRepair(database: SellerDatabase) {
  return inTransaction(database, async (tx) => {
    const rows = (
      await tx.client.query<{
        id: string;
        sellerId: string;
      }>(`SELECT a.id,a.seller_id AS "sellerId" FROM treido.payment_attempts a
      WHERE a.state<>'cancelled' AND a.reconcile_at<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='payment.reconcile' AND j.resource_id=a.id AND j.state IN ('pending','accepted','dead'))
      ORDER BY a.reconcile_at,a.id LIMIT 20 FOR UPDATE OF a SKIP LOCKED`)
    ).rows;
    for (const row of rows) {
      await enqueuePaymentObservation(tx, row.id, row.sellerId);
      await tx.client.query(
        `UPDATE treido.payment_attempts SET reconcile_at=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
        [row.id],
      );
    }
    const refunds = (
      await tx.client.query<{
        id: string;
        sellerId: string;
      }>(`SELECT r.id,r.seller_id AS "sellerId" FROM treido.payment_refunds r WHERE r.state NOT IN ('succeeded','failed') AND r.reconcile_at<=clock_timestamp()
      AND NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='payment.refund' AND j.resource_id=r.id AND j.state IN ('pending','accepted','dead')) ORDER BY r.reconcile_at,r.id LIMIT 20 FOR UPDATE OF r SKIP LOCKED`)
    ).rows;
    for (const row of refunds) {
      await enqueueJob(tx, {
        kind: "payment.refund",
        sellerId: row.sellerId,
        resourceId: row.id,
        operationKey: randomUUID(),
        actorId: null,
        authority: "service",
      });
      await tx.client.query(
        `UPDATE treido.payment_refunds SET reconcile_at=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
        [row.id],
      );
    }
    return { attempts: rows.length, refunds: refunds.length };
  });
}
