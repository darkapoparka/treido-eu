import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type {
  EffectContext,
  EffectResult,
} from "../../server/jobs/execution.server";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { SellerError } from "../sellers/errors";
import { lockAllocation } from "../inventory/allocations.server";
import { aftercareStorageAvailable } from "./storage.server";
import {
  readRefundIntent,
  verifyRefundParameters,
  type RefundIntent,
} from "./refund-storage.server";
import {
  orderRefundProvider,
  assertRefundBinding,
  findOriginalRefund,
  observeOriginalRefund,
} from "./refund-provider.server";
export async function enqueueRefundObservation(
  tx: SellerTransaction,
  row: Pick<RefundIntent, "id" | "sellerId">,
  operationKey: string = randomUUID(),
) {
  return enqueueJob(tx, {
    kind: "payment.aftercare",
    sellerId: row.sellerId,
    resourceId: row.id,
    operationKey,
    actorId: null,
    authority: "service",
  });
}
export async function processOrderRefund(
  database: SellerDatabase,
  job: EffectContext,
): Promise<EffectResult> {
  if (
    job.kind !== "payment.aftercare" ||
    job.authority !== "service" ||
    job.actorId !== null
  )
    throw new SellerError("FORBIDDEN");
  const source = await inTransaction(database, async (tx) => {
    if (!(await aftercareStorageAvailable(tx)))
      throw new SellerError("NOT_AVAILABLE");
    const initial = await readRefundIntent(tx, job.resourceId);
    if (!initial || initial.sellerId !== job.sellerId)
      throw new SellerError("NOT_FOUND");
    await lockAllocation(tx, initial.allocationId);
    await tx.client.query(
      "SELECT id FROM treido.paid_orders WHERE id=$1 FOR UPDATE",
      [initial.orderId],
    );
    const row = await readRefundIntent(tx, initial.id, true);
    if (!row) throw new SellerError("NOT_FOUND");
    verifyRefundParameters(row);
    if (
      row.state === "prepared" ||
      row.state === "expired" ||
      row.state === "remedy_required" ||
      row.state === "succeeded"
    )
      return { row, skip: true, expectedFee: 0, successfulCount: 0 };
    if (!row.firstAttemptAt) throw new SellerError("CONFLICT");
    const generation = (
      await tx.client.query<{ generation: number }>(
        "UPDATE treido.order_refund_intents SET generation=generation+1 WHERE id=$1 RETURNING generation",
        [row.id],
      )
    ).rows[0];
    row.generation = generation.generation;
    const totals = (
      await tx.client.query<{ fee: number; n: number }>(
        "SELECT coalesce(sum(fee_minor),0)::int AS fee,count(*)::int AS n FROM treido.order_refund_intents WHERE order_id=$1 AND provider_status='succeeded' AND id<>$2",
        [row.orderId, row.id],
      )
    ).rows[0];
    return {
      row,
      skip: false,
      expectedFee: totals.fee + row.feeMinor,
      successfulCount: totals.n + 1,
    };
  });
  if (source.skip) return { resultId: source.row.id };
  const provider = await orderRefundProvider();
  assertRefundBinding(source.row, provider.binding);
  const refund = await findOriginalRefund(provider.stripe, source.row);
  const observation = await observeOriginalRefund(
    provider.stripe,
    source.row,
    refund,
    source.expectedFee,
    source.successfulCount,
  );
  return {
    resultId: source.row.id,
    ...(observation.providerId
      ? { providerObjectId: observation.providerId }
      : {}),
    lock: async (tx) => {
      await lockAllocation(tx, source.row.allocationId);
      await tx.client.query(
        "SELECT id FROM treido.paid_orders WHERE id=$1 FOR UPDATE",
        [source.row.orderId],
      );
    },
    apply: async (tx) => {
      const row = await readRefundIntent(tx, source.row.id, true);
      if (
        !row ||
        row.generation !== source.row.generation ||
        row.state === "expired" ||
        row.state === "remedy_required"
      )
        return;
      verifyRefundParameters(row);
      if (
        row.providerId &&
        observation.providerId &&
        row.providerId !== observation.providerId
      )
        throw new SellerError("CONFLICT");
      await tx.client.query(
        "INSERT INTO treido.order_refund_observations(id,intent_id,generation,provider_id,provider_status,amount_minor,settlement_state,refund_fact) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          randomUUID(),
          row.id,
          row.generation,
          observation.providerId,
          observation.providerStatus,
          row.amountMinor,
          observation.settlementState,
          observation.fact,
        ],
      );
      await tx.client.query(
        "UPDATE treido.order_refund_intents SET provider_id=coalesce(provider_id,$2),provider_status=$3,state=$4,settlement_state=$5,revision=revision+1,reconcile_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() WHERE id=$1",
        [
          row.id,
          observation.providerId,
          observation.providerStatus,
          observation.state,
          observation.settlementState,
        ],
      );
      const totals = (
        await tx.client.query<{ paid: number; pending: boolean }>(
          "SELECT coalesce(sum(amount_minor) FILTER(WHERE provider_status='succeeded'),0)::int AS paid,bool_or(state NOT IN ('succeeded','expired')) AS pending FROM treido.order_refund_intents WHERE order_id=$1",
          [row.orderId],
        )
      ).rows[0];
      const payment =
        observation.state === "remedy_required"
          ? "reconciliation"
          : totals.pending
            ? "refund_pending"
            : totals.paid === row.totalMinor
              ? "refunded"
              : "paid";
      if (observation.fact.chargeDisputed) {
        await tx.client.query(
          "UPDATE treido.paid_orders SET payment_state='disputed',fulfilment_state='blocked',settlement_state='reconciliation',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
          [row.orderId],
        );
        return;
      }
      await tx.client.query(
        "UPDATE treido.paid_orders SET payment_state=$2,fulfilment_state='blocked',settlement_state=CASE WHEN $3 THEN 'reversed' WHEN $4 THEN 'reconciliation' ELSE settlement_state END,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 AND payment_state<>'disputed'",
        [
          row.orderId,
          payment,
          totals.paid === row.totalMinor && !totals.pending,
          observation.settlementState !== "verified",
        ],
      );
    },
  };
}
export async function scheduleOrderRefundRepair(database: SellerDatabase) {
  return inTransaction(database, async (tx) => {
    if (!(await aftercareStorageAvailable(tx))) return 0;
    const candidates = (
      await tx.client.query<{ id: string; allocationId: string }>(
        "SELECT r.id,q.allocation_id AS \"allocationId\" FROM treido.order_refund_intents r JOIN treido.payable_quotes q ON q.id=r.quote_id WHERE r.reconcile_at<=clock_timestamp() AND r.state IN ('prepared','creating','pending','reconciling') ORDER BY r.reconcile_at,r.id LIMIT 20",
      )
    ).rows;
    let queued = 0;
    for (const item of candidates) {
      await lockAllocation(tx, item.allocationId);
      const row = await readRefundIntent(tx, item.id, true);
      if (!row) continue;
      if (row.state === "prepared") {
        await tx.client.query(
          "UPDATE treido.order_refund_intents SET state='expired',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 AND first_attempt_at IS NULL AND provider_id IS NULL AND expires_at<=clock_timestamp()",
          [row.id],
        );
        continue;
      }
      if (!["creating", "pending", "reconciling"].includes(row.state)) continue;
      const active = (
        await tx.client.query(
          "SELECT id FROM treido.outbox_jobs WHERE kind='payment.aftercare' AND resource_id=$1 AND state IN ('pending','accepted') LIMIT 1",
          [row.id],
        )
      ).rowCount;
      if (active) continue;
      await enqueueRefundObservation(tx, row);
      await tx.client.query(
        "UPDATE treido.order_refund_intents SET reconcile_at=clock_timestamp()+interval '1 minute' WHERE id=$1",
        [row.id],
      );
      queued++;
    }
    return queued;
  });
}
