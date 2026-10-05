import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { lockAllocation } from "../inventory/allocations.server";
import { parseAftercareCommand } from "./model";
import {
  orderContext,
  aftercareStorageAvailable,
  aftercareReceipt,
  saveAftercareReceipt,
} from "./storage.server";
import { acceptedFinancialPolicy } from "./policy.server";
export async function changeOrderFulfilment(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseAftercareCommand(raw);
  if (
    command.action !== "record_tracking" &&
    command.action !== "confirm_delivery"
  )
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeHuman(tx, identity, true);
    const initial = await orderContext(
      tx,
      identity,
      command,
      command.sellerId ? "order.fulfil" : "order.read",
    );
    await lockAllocation(tx, initial.allocationId);
    const order = await orderContext(
      tx,
      identity,
      command,
      command.sellerId ? "order.fulfil" : "order.read",
      true,
    );
    if (!(await aftercareStorageAvailable(tx)))
      throw new SellerError("NOT_AVAILABLE");
    const prior = await aftercareReceipt(tx, order, command.requestId, command);
    if (prior)
      return {
        orderId: order.orderId,
        requestId: command.requestId,
        caseId: prior.caseId,
        intentId: prior.intentId,
        revision: prior.revision,
        state: prior.state,
      };
    const policy = await acceptedFinancialPolicy(tx, order);
    if (
      !policy ||
      policy.method !== "shipping" ||
      !policy.trackingAllowed ||
      order.terms.handover !== "shipping"
    )
      throw new SellerError("NOT_AVAILABLE");
    const shippingReady = (
      await tx.client.query<{ ready: boolean }>(
        "SELECT treido.order_shipping_retention_ready(p.id,p.environment,p.application_id) AS ready FROM treido.order_shipping_choices c JOIN treido.order_shipping_policies p ON p.id=(c.snapshot->\'option\'->\'policy\'->>\'id\')::uuid AND p.terms_hash=c.snapshot->\'option\'->\'policy\'->>\'termsHash\' WHERE c.quote_id=$1 AND c.buyer_id=$2 AND c.seller_id=$3 AND c.state=\'bound\'",
        [order.quoteId, order.buyerId, order.sellerId],
      )
    ).rows[0];
    if (shippingReady?.ready !== true) throw new SellerError("NOT_AVAILABLE");
    if (
      order.paymentState !== "paid" ||
      order.settlementState !== "transferred" ||
      (
        await tx.client.query(
          "SELECT id FROM treido.order_refund_intents WHERE order_id=$1 AND state<>'expired' LIMIT 1",
          [order.orderId],
        )
      ).rowCount ||
      (
        await tx.client.query(
          "SELECT id FROM treido.payment_refunds WHERE order_id=$1",
          [order.orderId],
        )
      ).rowCount
    )
      throw new SellerError("CONFLICT");
    const recent = (
      await tx.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM treido.order_aftercare_receipts WHERE actor_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [order.actorId],
      )
    ).rows[0];
    if (recent.n >= 20) throw new SellerError("QUOTA_EXCEEDED");
    const history = (
      await tx.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM treido.order_fulfilment_events WHERE order_id=$1",
        [order.orderId],
      )
    ).rows[0];
    if (history.n >= 500) throw new SellerError("QUOTA_EXCEEDED");
    const current = (
      await tx.client.query<{ state: string; revision: number }>(
        "SELECT state,revision FROM treido.order_fulfilments WHERE order_id=$1 FOR UPDATE",
        [order.orderId],
      )
    ).rows[0];
    if ((current?.revision ?? 0) !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    if (
      current?.state === "buyer_confirmed_delivery" ||
      current?.state === "blocked"
    )
      throw new SellerError("CONFLICT");
    if (
      command.action === "confirm_delivery" &&
      (order.side !== "buyer" ||
        current?.state !== "seller_reported_dispatched")
    )
      throw new SellerError("CONFLICT");
    if (command.action === "record_tracking") {
      const accepted = (
        await tx.client.query<{ code: string }>(
          "SELECT c.snapshot->'option'->'binding'->>'carrierCode' AS code FROM treido.order_shipping_choices c WHERE c.quote_id=$1 AND c.buyer_id=$2 AND c.seller_id=$3 AND c.state='bound' FOR SHARE",
          [order.quoteId, order.buyerId, order.sellerId],
        )
      ).rows[0];
      if (!accepted || command.carrier !== accepted.code)
        throw new SellerError("INVALID_INPUT");
    }
    if (command.action === "record_tracking" && order.side !== "merchant")
      throw new SellerError("FORBIDDEN");
    if (!current)
      await tx.client.query(
        "INSERT INTO treido.order_fulfilments(order_id,quote_id,method,state) VALUES($1,$2,'shipping','pending')",
        [order.orderId, order.quoteId],
      );
    const state =
        command.action === "record_tracking"
          ? "seller_reported_dispatched"
          : "buyer_confirmed_delivery",
      next = command.expectedRevision + 1;
    await tx.client.query(
      "UPDATE treido.order_fulfilments SET state=$2,revision=$3,carrier=coalesce($4,carrier),tracking_reference=coalesce($5,tracking_reference),description=$6,updated_at=clock_timestamp() WHERE order_id=$1",
      [
        order.orderId,
        state,
        next,
        command.action === "record_tracking" ? command.carrier : null,
        command.action === "record_tracking" ? command.trackingReference : null,
        command.description,
      ],
    );
    await tx.client.query(
      "INSERT INTO treido.order_fulfilment_events(id,order_id,actor_id,kind,description,accepted_revision) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        order.orderId,
        order.actorId,
        state,
        command.description,
        next,
      ],
    );
    await tx.client.query(
      "UPDATE treido.paid_orders SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
      [order.orderId],
    );
    return saveAftercareReceipt(tx, order, command, {
      caseId: null,
      intentId: null,
      revision: next,
      state,
    });
  });
}
