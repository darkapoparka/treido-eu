import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import {
  authorizeHuman,
  authorizeSeller,
  inputHash,
} from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { quoteLines } from "./quotes.server";
import { parseOrderCommand, type OrderView } from "./model";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { paymentBindings, type PaymentBindings } from "./bindings.server";
import { lockAllocation } from "../inventory/allocations.server";
import {
  attemptColumns,
  assertAttemptScope,
  type AttemptRow,
} from "./attempts.server";
import { legacyFullRefundMustOwnEntireBalance } from "../order-aftercare/storage.server";
import { requireJobBindings } from "../../server/jobs/config.server";

const publicShippingTermsSql =
  "CASE WHEN q.terms_snapshot->>'handover'='shipping' THEN jsonb_build_object('format','goods-shipping-v1','country',q.terms_snapshot->'shipping'->'country','costs',q.terms_snapshot->'shipping'->'costs','terms',q.terms_snapshot->'shipping'->'terms','rights',q.terms_snapshot->'shipping'->'rights','refundTerms',q.terms_snapshot->'shipping'->'refundTerms','taxDescription',q.terms_snapshot->'shipping'->'taxDescription','recipientPurpose',q.terms_snapshot->'shipping'->'recipientPurpose','retentionDescription',q.terms_snapshot->'shipping'->'retentionDescription') ELSE NULL END";
const orderColumns = `o.id,o.quote_id AS "quoteId",o.seller_id AS "sellerId",q.seller_name AS "sellerName",q.total_minor AS "totalMinor",q.total_minor-q.delivery_minor-q.buyer_fee_minor AS "merchandiseMinor",q.delivery_minor AS "shippingMinor",q.buyer_fee_minor AS "buyerFeeMinor",q.terms_snapshot->>'handover' AS handover,${publicShippingTermsSql} AS shipping,CASE WHEN q.terms_snapshot->>\'handover\'=\'shipping\' THEN coalesce((SELECT f.state FROM treido.order_fulfilments f JOIN treido.quote_aftercare_acceptances ac ON ac.quote_id=f.quote_id AND ac.method=\'shipping\' WHERE f.order_id=o.id AND f.quote_id=q.id AND f.method=\'shipping\'),\'pending\') ELSE NULL END AS "shippingFulfilmentState",q.currency,
  o.payment_state AS "paymentState",o.fulfilment_state AS "fulfilmentState",o.settlement_state AS "settlementState",(SELECT r.state FROM treido.payment_refunds r WHERE r.order_id=o.id) AS "refundState",o.revision,o.created_at AS "createdAt"`;
export async function readPaidOrders(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string | null,
  id?: string,
): Promise<OrderView[]> {
  if ((id && !validId(id)) || (sellerId && !validId(sellerId)))
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = sellerId
      ? (await authorizeSeller(tx, identity, sellerId, "order.read")).user
      : await authorizeHuman(tx, identity, false);
    const rows = (
      await tx.client.query<
        Omit<OrderView, "lines" | "createdAt"> & { createdAt: Date }
      >(
        `SELECT ${orderColumns} FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id
      WHERE ${sellerId ? "o.seller_id=$1" : "o.buyer_id=$1"} AND ($2::uuid IS NULL OR o.id=$2) ORDER BY o.created_at DESC,o.id DESC LIMIT 30`,
        [sellerId ?? user.id, id ?? null],
      )
    ).rows;
    if (id && !rows.length) throw new SellerError("NOT_FOUND");
    const result: OrderView[] = [];
    for (const row of rows)
      result.push({
        ...row,
        createdAt: row.createdAt.toISOString(),
        lines: await quoteLines(tx, row.quoteId),
      });
    return result;
  });
}
export async function changePaidOrder(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseOrderCommand(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  let binding: PaymentBindings | undefined;
  if (command.action === "refund") {
    if (!hasVerifiedRecentAuthentication(identity))
      throw new SellerError("FORBIDDEN");
    binding = paymentBindings();
    const jobs = requireJobBindings();
    if (jobs.applicationId !== binding.applicationId)
      throw new SellerError("NOT_AVAILABLE");
  }
  return inTransaction(database, async (tx) => {
    const access = command.sellerId
      ? await authorizeSeller(
          tx,
          identity,
          command.sellerId,
          command.action === "refund" ? "refund.request" : "order.fulfil",
        )
      : null;
    const user = access?.user ?? (await authorizeHuman(tx, identity, false));
    const initial = (
      await tx.client.query<AttemptRow>(
        `SELECT ${attemptColumns} FROM treido.paid_orders o JOIN treido.payment_attempts a ON a.id=o.attempt_id JOIN treido.payable_quotes q ON q.id=a.quote_id
      WHERE o.id=$1 AND ${command.sellerId ? "o.seller_id=$2" : "o.buyer_id=$2"}`,
        [command.id, command.sellerId ?? user.id],
      )
    ).rows[0];
    if (!initial) throw new SellerError("NOT_FOUND");
    await lockAllocation(tx, initial.allocationId);
    const order = (
      await tx.client.query<OrderView>(
        `SELECT ${orderColumns} FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id WHERE o.id=$1 FOR UPDATE OF o`,
        [command.id],
      )
    ).rows[0];
    const prior = (
      await tx.client.query<{
        hash: string;
        actorId: string;
        revision: number;
      }>(
        `SELECT input_hash AS hash,actor_id AS "actorId",accepted_revision AS revision FROM treido.paid_order_receipts WHERE order_id=$1 AND request_id=$2`,
        [command.id, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.hash !== inputHash(command) || prior.actorId !== user.id)
        throw new SellerError("CONFLICT");
      return { id: order.id, revision: prior.revision };
    }
    if (order.handover !== "pickup") throw new SellerError("NOT_AVAILABLE");
    if (order.revision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    if (command.action === "refund") {
      assertAttemptScope(initial, binding!);
      if (initial.terms.refundPolicy !== "full_fee_and_transfer_reversal")
        throw new SellerError("NOT_AVAILABLE");
      if (order.refundState !== null) throw new SellerError("CONFLICT");
      if (
        !initial.providerId ||
        !["paid", "reconciliation", "disputed"].includes(order.paymentState)
      )
        throw new SellerError("CONFLICT");
      const id = randomUUID();
      const parameters = {
        payment_intent: initial.providerId,
        amount: initial.totalMinor,
        refund_application_fee: initial.applicationFeeMinor > 0,
        reverse_transfer: true,
        metadata: {
          refund_id: id,
          attempt_id: initial.id,
          application_id: binding!.applicationId,
          environment: binding!.environment,
        },
      };
      await legacyFullRefundMustOwnEntireBalance(tx, order.id);
      await tx.client.query(
        `INSERT INTO treido.payment_refunds(id,order_id,attempt_id,seller_id,actor_id,reason,recent_auth_verified_at,operation_key,parameters,parameter_hash) VALUES($1,$2,$3,$4,$5,$6,clock_timestamp(),$7,$8,$9)`,
        [
          id,
          order.id,
          initial.id,
          initial.sellerId,
          user.id,
          command.reason,
          `treido:refund:v1:${id}`,
          parameters,
          inputHash(parameters),
        ],
      );
      await enqueueJob(tx, {
        kind: "payment.refund",
        sellerId: initial.sellerId,
        resourceId: id,
        operationKey: command.requestId,
        actorId: null,
        authority: "service",
      });
      await tx.client.query(
        `UPDATE treido.paid_orders SET payment_state='refund_pending',fulfilment_state='blocked',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1`,
        [order.id],
      );
    } else {
      if (
        order.paymentState !== "paid" ||
        order.settlementState !== "transferred" ||
        order.fulfilmentState !==
          (command.action === "ready" ? "pending" : "ready")
      )
        throw new SellerError("CONFLICT");
      await tx.client.query(
        `UPDATE treido.paid_orders SET fulfilment_state=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1`,
        [order.id, command.action === "ready" ? "ready" : "collected"],
      );
    }
    await tx.client.query(
      `INSERT INTO treido.paid_order_receipts(order_id,request_id,actor_id,command,input_hash,accepted_revision) VALUES($1,$2,$3,$4,$5,$6)`,
      [
        order.id,
        command.requestId,
        user.id,
        command.action,
        inputHash(command),
        order.revision + 1,
      ],
    );
    return { id: order.id, revision: order.revision + 1 };
  });
}
