import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { lockAllocation } from "../inventory/allocations.server";
import {
  orderContext,
  aftercareStorageAvailable,
} from "../order-aftercare/storage.server";
import { parseRecovery } from "../order-aftercare/model";
import { parseFeedbackCommand } from "./model";
import {
  feedbackStorageAvailable,
  readFeedbackPolicy,
  feedbackEligible,
} from "./storage.server";
export async function submitOrderFeedback(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseFeedbackCommand(raw);
  return inTransaction(database, async (tx) => {
    await authorizeHuman(tx, identity, true);
    const initial = await orderContext(tx, identity, command);
    await lockAllocation(tx, initial.allocationId);
    const order = await orderContext(tx, identity, command, "order.read", true);
    if (
      !(await feedbackStorageAvailable(tx.client)) ||
      !(await aftercareStorageAvailable(tx))
    )
      throw new SellerError("NOT_AVAILABLE");
    const prior = (
      await tx.client.query<{
        hash: string;
        feedbackId: string;
        revision: number;
        orderId: string;
      }>(
        'SELECT input_hash AS hash,feedback_id AS "feedbackId",accepted_revision AS revision,order_id AS "orderId" FROM treido.order_feedback_receipts WHERE actor_id=$1 AND request_id=$2 AND action=$3',
        [order.actorId, command.requestId, "submit"],
      )
    ).rows[0];
    if (prior) {
      if (prior.hash !== inputHash(command) || prior.orderId !== order.orderId)
        throw new SellerError("CONFLICT");
      return {
        orderId: order.orderId,
        requestId: command.requestId,
        feedbackId: prior.feedbackId,
        revision: prior.revision,
      };
    }
    if (order.orderRevision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    const policy = await readFeedbackPolicy(tx, order, command.policyId);
    if (
      !policy ||
      policy.version !== command.version ||
      policy.termsHash !== command.termsHash
    )
      throw new SellerError("NOT_AVAILABLE");
    if (!(await feedbackEligible(tx.client, order.orderId)))
      throw new SellerError("CONFLICT");
    if (
      (
        await tx.client.query(
          "SELECT id FROM treido.order_purchase_feedback WHERE order_id=$1",
          [order.orderId],
        )
      ).rowCount
    )
      throw new SellerError("CONFLICT");
    const n = (
      await tx.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM treido.order_feedback_receipts WHERE actor_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [order.actorId],
      )
    ).rows[0];
    if (n.n >= 20) throw new SellerError("QUOTA_EXCEEDED");
    const id = randomUUID();
    await tx.client.query(
      "INSERT INTO treido.order_purchase_feedback(id,order_id,buyer_id,seller_id,policy_id,rating,body,language) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        order.orderId,
        order.buyerId,
        order.sellerId,
        policy.id,
        command.rating,
        command.body,
        command.language,
      ],
    );
    await tx.client.query(
      "INSERT INTO treido.order_feedback_events(id,feedback_id,actor_id,action,reason,accepted_revision) VALUES($1,$2,$3,'submit','',0)",
      [randomUUID(), id, order.actorId],
    );
    await tx.client.query(
      "INSERT INTO treido.order_feedback_receipts(actor_id,request_id,order_id,feedback_id,input_hash,action,accepted_revision) VALUES($1,$2,$3,$4,$5,'submit',0)",
      [order.actorId, command.requestId, order.orderId, id, inputHash(command)],
    );
    return {
      orderId: order.orderId,
      requestId: command.requestId,
      feedbackId: id,
      revision: 0,
    };
  });
}
export async function recoverOrderFeedback(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseRecovery(raw);
  if (command.sellerId !== null) throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const order = await orderContext(tx, identity, command);
    if (!(await feedbackStorageAvailable(tx.client)))
      throw new SellerError("NOT_AVAILABLE");
    const row = (
      await tx.client.query<{ feedbackId: string; revision: number }>(
        'SELECT feedback_id AS "feedbackId",accepted_revision AS revision FROM treido.order_feedback_receipts WHERE actor_id=$1 AND request_id=$2 AND order_id=$3 AND action=$4',
        [order.actorId, command.requestId, order.orderId, "submit"],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    return { orderId: order.orderId, requestId: command.requestId, ...row };
  });
}
