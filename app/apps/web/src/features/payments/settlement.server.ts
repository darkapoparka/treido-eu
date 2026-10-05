import "server-only";
import { aftercareStorageAvailable } from "../order-aftercare/storage.server";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import type { SellerTransaction } from "../../server/db/database";
import {
  releaseAllocation,
  settleAllocation,
  lockAllocation,
} from "../inventory/allocations.server";
import { SellerError } from "../sellers/errors";
import {
  approvedPolicy,
  sellerBinding,
  approvedListing,
} from "./registry.server";
import { quoteLines } from "./quotes.server";
import {
  attemptColumns,
  type AttemptRow,
  verifyPaymentIntent,
} from "./attempts.server";
import type { PaymentBindings } from "./bindings.server";

export type ProviderFact = {
  kind:
    | "charge"
    | "transfer"
    | "application_fee"
    | "provider_fee"
    | "refund"
    | "transfer_reversal"
    | "fee_refund"
    | "dispute";
  objectId: string;
  amountMinor: number;
  currency: string;
};
export async function appendFacts(
  tx: SellerTransaction,
  row: AttemptRow,
  facts: ProviderFact[],
) {
  for (const fact of facts) {
    const prior = (
      await tx.client.query<{
        attemptId: string;
        amount: string;
        currency: string;
      }>(
        `SELECT attempt_id AS "attemptId",amount_minor AS amount,currency FROM treido.payment_facts WHERE platform_account=$1 AND livemode=$2 AND kind=$3 AND object_id=$4`,
        [row.platformAccount, row.livemode, fact.kind, fact.objectId],
      )
    ).rows[0];
    if (
      prior &&
      (prior.attemptId !== row.id ||
        Number(prior.amount) !== fact.amountMinor ||
        prior.currency !== fact.currency)
    )
      throw new SellerError("CONFLICT");
    if (!prior)
      await tx.client.query(
        `INSERT INTO treido.payment_facts(attempt_id,platform_account,livemode,kind,object_id,currency,amount_minor) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          row.id,
          row.platformAccount,
          row.livemode,
          fact.kind,
          fact.objectId,
          fact.currency,
          fact.amountMinor,
        ],
      );
  }
}
function objectId(value: { id: string } | string | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null);
}
export async function paymentFacts(
  stripe: Stripe,
  row: AttemptRow,
  intent: Stripe.PaymentIntent,
) {
  const facts: ProviderFact[] = [];
  let transferVerified = false,
    disputed = false,
    refundedMinor = 0,
    financialFactsComplete = false;
  if (intent.status !== "succeeded")
    return {
      facts,
      transferVerified,
      disputed,
      refundedMinor,
      financialFactsComplete,
    };
  const chargeId = objectId(intent.latest_charge);
  if (!chargeId) throw new SellerError("CONFLICT");
  const charge = await stripe.charges.retrieve(chargeId, {
    expand: ["balance_transaction", "application_fee", "transfer"],
  });
  if (
    charge.livemode !== row.livemode ||
    objectId(charge.payment_intent) !== intent.id ||
    charge.amount !== row.totalMinor ||
    charge.currency !== "eur" ||
    !charge.paid ||
    !charge.captured ||
    intent.amount_received !== row.totalMinor
  )
    throw new SellerError("CONFLICT");
  facts.push({
    kind: "charge",
    objectId: charge.id,
    amountMinor: charge.amount,
    currency: charge.currency,
  });
  disputed = charge.disputed;
  refundedMinor = charge.amount_refunded;
  const balance = charge.balance_transaction;
  if (balance && typeof balance !== "string")
    facts.push({
      kind: "provider_fee",
      objectId: balance.id,
      amountMinor: balance.fee,
      currency: balance.currency,
    });
  const applicationFee = charge.application_fee;
  if (applicationFee && typeof applicationFee !== "string") {
    if (
      applicationFee.amount !== row.applicationFeeMinor ||
      applicationFee.currency !== "eur" ||
      objectId(applicationFee.charge) !== charge.id
    )
      throw new SellerError("CONFLICT");
    facts.push({
      kind: "application_fee",
      objectId: applicationFee.id,
      amountMinor: applicationFee.amount,
      currency: applicationFee.currency,
    });
  }
  const transfer = charge.transfer;
  if (transfer && typeof transfer !== "string") {
    if (
      objectId(transfer.destination) !== row.connectedAccount ||
      transfer.amount !== row.totalMinor ||
      transfer.currency !== "eur" ||
      objectId(transfer.source_transaction) !== charge.id ||
      transfer.livemode !== row.livemode
    )
      throw new SellerError("CONFLICT");
    facts.push({
      kind: "transfer",
      objectId: transfer.id,
      amountMinor: transfer.amount,
      currency: transfer.currency,
    });
    transferVerified = transfer.amount_reversed === 0 && !transfer.reversed;
  }
  financialFactsComplete =
    facts.some((f) => f.kind === "provider_fee") &&
    (row.applicationFeeMinor === 0 ||
      facts.some((f) => f.kind === "application_fee"));
  if (disputed)
    for await (const dispute of stripe.disputes.list({
      charge: charge.id,
      limit: 100,
    })) {
      if (
        dispute.payment_intent !== intent.id ||
        dispute.currency !== "eur" ||
        dispute.livemode !== row.livemode
      )
        throw new SellerError("CONFLICT");
      facts.push({
        kind: "dispute",
        objectId: dispute.id,
        amountMinor: dispute.amount,
        currency: dispute.currency,
      });
    }
  return {
    facts,
    transferVerified,
    disputed,
    refundedMinor,
    financialFactsComplete,
  };
}
export async function applyPaymentObservation(
  tx: SellerTransaction,
  initial: AttemptRow,
  intent: Stripe.PaymentIntent | null,
  binding: PaymentBindings,
  observation: Awaited<ReturnType<typeof paymentFacts>> | null,
) {
  await lockAllocation(tx, initial.allocationId);
  const row = (
    await tx.client.query<AttemptRow>(
      `SELECT ${attemptColumns} FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE a.id=$1 FOR UPDATE OF a`,
      [initial.id],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  if (!intent) {
    await tx.client.query(
      `UPDATE treido.payment_attempts SET state=CASE WHEN state IN ('paid','cancelled','quarantined') THEN state ELSE 'reconciling' END,observed_at=clock_timestamp(),reconcile_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() WHERE id=$1`,
      [row.id],
    );
    return;
  }
  verifyPaymentIntent(row, intent, binding);
  if (row.state === "cancelled" && intent.status !== "canceled")
    throw new SellerError("CONFLICT");
  await tx.client.query(
    `UPDATE treido.payment_attempts SET provider_id=coalesce(provider_id,$2),observed_at=clock_timestamp(),updated_at=clock_timestamp(),reconcile_at=clock_timestamp()+interval '1 minute' WHERE id=$1`,
    [row.id, intent.id],
  );
  if (intent.status === "canceled") {
    if (["paid", "quarantined"].includes(row.state))
      throw new SellerError("CONFLICT");
    // Only verified terminal cancellation removes payment risk before releasing stock.
    await tx.client.query(
      `UPDATE treido.payment_attempts SET state='cancelled' WHERE id=$1`,
      [row.id],
    );
    await releaseAllocation(
      tx,
      row.allocationId,
      null,
      row.expiresAt.getTime() <= Date.now() ? "expired" : "cancelled",
    );
    return;
  }
  if (intent.status !== "succeeded") {
    if (["paid", "quarantined"].includes(row.state)) return;
    const state =
      row.cancelRequested || row.expiresAt.getTime() <= Date.now()
        ? "cancelling"
        : intent.status === "processing" || intent.status === "requires_capture"
          ? "processing"
          : intent.status === "requires_action"
            ? "requires_action"
            : "requires_payment_method";
    await tx.client.query(
      `UPDATE treido.payment_attempts SET state=$2 WHERE id=$1`,
      [row.id, state],
    );
    return;
  }
  if (!observation) throw new SellerError("CONFLICT");
  await appendFacts(tx, row, observation.facts);
  const accepted = (
    await tx.client.query<{ id: string }>(
      "SELECT o.id FROM treido.paid_orders o JOIN treido.inventory_allocations a ON a.id=$2 WHERE o.attempt_id=$1 AND o.quote_id=$3 AND o.buyer_id=$4 AND o.seller_id=$5 AND a.state='consumed' AND a.buyer_id=o.buyer_id AND a.seller_id=o.seller_id AND a.resolution_reference=$6 AND EXISTS(SELECT 1 FROM treido.payment_facts f WHERE f.attempt_id=o.attempt_id AND f.kind='charge' AND f.platform_account=$7 AND f.livemode=$8 AND f.amount_minor=$9 AND f.currency='eur')",
      [
        row.id,
        row.allocationId,
        row.quoteId,
        row.buyerId,
        row.sellerId,
        "stripe:" + intent.id,
        row.platformAccount,
        row.livemode,
        row.totalMinor,
      ],
    )
  ).rows[0];
  if (accepted && (await aftercareStorageAvailable(tx))) {
    const managed = (
      await tx.client.query<{ reserved: number; n: number }>(
        "SELECT coalesce(sum(amount_minor),0)::int AS reserved,count(*)::int AS n FROM treido.order_refund_intents WHERE order_id=$1 AND first_attempt_at IS NOT NULL AND state<>'expired'",
        [accepted.id],
      )
    ).rows[0];
    if (managed.n > 0) {
      const unsafe =
        observation.disputed || observation.refundedMinor > managed.reserved;
      await tx.client.query(
        "UPDATE treido.payment_attempts SET state=$2,reconcile_at=clock_timestamp()+interval '5 minutes' WHERE id=$1",
        [row.id, unsafe ? "quarantined" : "paid"],
      );
      if (unsafe)
        await tx.client.query(
          "UPDATE treido.paid_orders SET payment_state=$2,fulfilment_state='blocked',settlement_state='reconciliation',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
          [accepted.id, observation.disputed ? "disputed" : "reconciliation"],
        );
      return;
    }
  }
  let qualified = Boolean(accepted);
  if (!accepted) {
    qualified = true;
    try {
      await approvedPolicy(tx, row.policyId, binding);
      const mapping = await sellerBinding(tx, row.sellerId, binding);
      if (
        mapping.id !== row.bindingId ||
        mapping.connectedAccount !== row.connectedAccount
      )
        qualified = false;
      for (const line of await quoteLines(tx, row.quoteId))
        await approvedListing(tx, row.sellerId, line, row.policyId);
      const parties = await tx.client.query(
        `SELECT u.id FROM treido.users u JOIN treido.seller_accounts s ON s.id=$2 WHERE u.id=$1 AND u.status='active' AND s.status='active'`,
        [row.buyerId, row.sellerId],
      );
      if (parties.rowCount !== 1) qualified = false;
    } catch (error) {
      if (!(error instanceof SellerError)) throw error;
      qualified = false;
    }
  }
  const inventory = await settleAllocation(
    tx,
    row.allocationId,
    `stripe:${intent.id}`,
    qualified,
  );
  const complete =
    qualified &&
    inventory === "consumed" &&
    observation.transferVerified &&
    observation.financialFactsComplete &&
    !observation.disputed &&
    observation.refundedMinor === 0;
  const payment = observation.disputed
    ? "disputed"
    : complete
      ? "paid"
      : "reconciliation";
  await tx.client.query(
    `UPDATE treido.payment_attempts SET state=$2,reconcile_at=clock_timestamp()+interval '5 minutes' WHERE id=$1`,
    [row.id, complete ? "paid" : "quarantined"],
  );
  await tx.client.query(
    `INSERT INTO treido.paid_orders(id,quote_id,attempt_id,seller_id,buyer_id,payment_state,fulfilment_state,settlement_state)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(quote_id) DO NOTHING`,
    [
      randomUUID(),
      row.quoteId,
      row.id,
      row.sellerId,
      row.buyerId,
      payment,
      complete ? "pending" : "blocked",
      observation.transferVerified ? "transferred" : "reconciliation",
    ],
  );
  // Fulfilment can never revive after a dispute/refund/quarantine. Existing
  // buyer/merchant command revisions remain meaningful across provider changes.
  const order = (
    await tx.client.query<{
      id: string;
      payment: string;
      fulfilment: string;
      settlement: string;
    }>(
      `SELECT id,payment_state AS payment,fulfilment_state AS fulfilment,settlement_state AS settlement FROM treido.paid_orders WHERE attempt_id=$1 FOR UPDATE`,
      [row.id],
    )
  ).rows[0];
  if (!order) throw new SellerError("CONFLICT");
  if (
    !["refund_pending", "refunded"].includes(order.payment) &&
    (order.payment !== payment ||
      (!complete && order.fulfilment !== "blocked") ||
      (!observation.transferVerified && order.settlement !== "reconciliation"))
  )
    await tx.client.query(
      `UPDATE treido.paid_orders SET payment_state=$2,fulfilment_state=CASE WHEN $3 THEN fulfilment_state ELSE 'blocked' END,settlement_state=$4,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1`,
      [
        order.id,
        payment,
        complete,
        observation.transferVerified ? "transferred" : "reconciliation",
      ],
    );
}
