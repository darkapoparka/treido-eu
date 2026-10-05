import "server-only";
import { receiveAftercareEvent } from "../order-aftercare/webhook.server";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import {
  stripeClient,
  paymentBindings,
  requireWebhookBinding,
} from "./bindings.server";
import { enqueuePaymentObservation } from "./attempts.server";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";

import { receiveBillingEvent } from "../seller-billing/jobs.server";
import { promotionStorageReady } from "../seller-billing/promotion-storage.server";
import { receivePromotionEvent } from "../promotions/jobs.server";

const EVENT_TYPES = new Set([
  "payment_intent.succeeded",
  "payment_intent.processing",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "payment_intent.requires_action",
  "charge.updated",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "refund.created",
  "refund.updated",
  "refund.failed",
]);
async function rawBody(request: Request) {
  const declared = request.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || Number(declared) > 262144)
  )
    throw new SellerError("INVALID_INPUT");
  if (!request.body) throw new SellerError("INVALID_INPUT");
  const reader = request.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 262144) {
        await reader.cancel();
        throw new SellerError("INVALID_INPUT");
      }
      parts.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts, size);
}
function linkedId(value: unknown) {
  if (typeof value === "string" && /^(pi|ch|re|dp)_[A-Za-z0-9]+$/.test(value))
    return value;
  if (value && typeof value === "object" && "id" in value)
    return linkedId((value as { id: unknown }).id);
  return null;
}
function receiptObjectId(value: unknown): string | null {
  return typeof value === "string" &&
    value.length <= 100 &&
    /^(pi_|ch_|re_|dp_|cs_(test_|live_)?|sub_|in_|cn_)[A-Za-z0-9]+$/.test(value)
    ? value
    : null;
}
export async function receiveStripeWebhook(
  database: SellerDatabase,
  request: Request,
) {
  const binding = paymentBindings(),
    webhook = requireWebhookBinding(binding),
    signature = request.headers.get("stripe-signature");
  if (!signature || signature.length > 4096)
    throw new SellerError("INVALID_INPUT");
  const body = await rawBody(request);
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(
      body,
      signature,
      webhook.signing,
      300,
    );
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
  if (
    event.livemode !== binding.livemode ||
    event.account ||
    !/^evt_[A-Za-z0-9]+$/.test(event.id)
  )
    throw new SellerError("FORBIDDEN");
  const object = event.data.object as unknown as {
    id?: unknown;
    payment_intent?: unknown;
    metadata?: { attempt_id?: unknown; refund_id?: unknown };
  };
  const objectId = receiptObjectId(object.id),
    intentId = event.type.startsWith("payment_intent.")
      ? linkedId(object.id)
      : linkedId(object.payment_intent);
  const attemptId = validId(object.metadata?.attempt_id)
    ? (object.metadata!.attempt_id as string)
    : null;
  const hash = createHash("sha256").update(body).digest("hex");
  return inTransaction(database, async (tx) => {
    await tx.client.query(
      `INSERT INTO treido.stripe_webhook_receipts(platform_account,livemode,event_id,event_type,body_hash,provider_created,object_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
      [
        binding.platformAccount,
        binding.livemode,
        event.id,
        event.type,
        hash,
        event.created,
        objectId,
      ],
    );
    const prior = (
      await tx.client.query<{ hash: string }>(
        `SELECT body_hash AS hash FROM treido.stripe_webhook_receipts WHERE platform_account=$1 AND livemode=$2 AND event_id=$3`,
        [binding.platformAccount, binding.livemode, event.id],
      )
    ).rows[0];
    if (prior?.hash !== hash) throw new SellerError("CONFLICT");
    await receiveBillingEvent(tx, event, binding);
    if (await promotionStorageReady(tx))
      await receivePromotionEvent(tx, event, binding);
    if (!EVENT_TYPES.has(event.type)) return { received: true };
    const aftercareOperation = createHash("sha256")
      .update(
        binding.platformAccount +
          ":" +
          binding.livemode +
          ":" +
          event.id +
          ":aftercare-v2",
      )
      .digest("hex");
    const aftercareKey =
      aftercareOperation.slice(0, 8) +
      "-" +
      aftercareOperation.slice(8, 12) +
      "-4" +
      aftercareOperation.slice(13, 16) +
      "-8" +
      aftercareOperation.slice(17, 20) +
      "-" +
      aftercareOperation.slice(20, 32);
    await receiveAftercareEvent(tx, event, binding, aftercareKey);
    const attempt = (
      await tx.client.query<{ id: string; sellerId: string }>(
        `SELECT id,seller_id AS "sellerId" FROM treido.payment_attempts WHERE platform_account=$1 AND livemode=$2 AND (($3::uuid IS NOT NULL AND id=$3) OR ($4::text IS NOT NULL AND provider_id=$4))`,
        [binding.platformAccount, binding.livemode, attemptId, intentId],
      )
    ).rows;
    if (attempt.length > 1) throw new SellerError("CONFLICT");
    if (attempt[0]) {
      // One event receipt and its observation handoff commit together. Different
      // event IDs still settle once via unique attempt/order/provider facts.
      const operation = createHash("sha256")
        .update(
          binding.platformAccount + ":" + binding.livemode + ":" + event.id,
        )
        .digest("hex");
      const operationKey = `${operation.slice(0, 8)}-${operation.slice(8, 12)}-4${operation.slice(13, 16)}-8${operation.slice(17, 20)}-${operation.slice(20, 32)}`;
      await enqueuePaymentObservation(
        tx,
        attempt[0].id,
        attempt[0].sellerId,
        operationKey,
      );
      const refunds = (
        await tx.client.query<{ id: string; sellerId: string }>(
          `SELECT id,seller_id AS "sellerId" FROM treido.payment_refunds WHERE attempt_id=$1 AND state NOT IN ('succeeded','failed')`,
          [attempt[0].id],
        )
      ).rows;
      for (const refund of refunds)
        await enqueueJob(tx, {
          kind: "payment.refund",
          sellerId: refund.sellerId,
          resourceId: refund.id,
          operationKey,
          actorId: null,
          authority: "service",
        });
    }
    return { received: true };
  });
}
