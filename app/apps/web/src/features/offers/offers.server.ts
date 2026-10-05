import "server-only";
import { libraryActorKey } from "../library/cursor.server";
import { expirePendingOffersInTransaction } from "./expiry.server";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { authorizeConversation } from "../messaging/conversation-access.server";
import { readPublicInventoryInTransaction } from "../inventory/queries.server";
import {
  allocateInventory,
  releaseAllocation,
} from "../inventory/allocations.server";
import {
  OFFER_LIMITS,
  parseOfferCommand,
  parseOfferQuery,
  type OfferItem,
  type OfferView,
  type OfferEventKind,
} from "./model";
import type { InboxScope } from "../messaging/inbox-model";
async function offerAccess(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  threadId: string,
  scope: InboxScope,
  write = false,
) {
  const access = await authorizeConversation(
    tx,
    identity,
    threadId,
    write ? "contact" : false,
    scope,
    write,
  );
  let mayManage = access.canBlock;
  if (access.side === "seller") {
    const seller = await authorizeSeller(
      tx,
      identity,
      access.thread.sellerId,
      "inbox.read",
    );
    mayManage =
      mayManage &&
      seller.context.capabilities.includes("listing.publish") &&
      (seller.seller.kind === "personal" ||
        seller.context.capabilities.includes("inventory.manage"));
  }
  return { ...access, mayManage, mayNegotiate: access.canReply && mayManage };
}
export async function readOffers(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<OfferView> {
  const query = parseOfferQuery(raw);
  return inTransaction(database, async (tx) => {
    const access = await offerAccess(tx, identity, query.threadId, {
      sellerId: query.sellerId,
    });
    const revision = (
      await tx.client.query<{ revision: number }>(
        "SELECT offer_revision AS revision FROM treido.conversation_threads WHERE id=$1",
        [query.threadId],
      )
    ).rows[0].revision;
    const inventory = await readPublicInventoryInTransaction(
      tx,
      access.thread.listingId,
    );
    const rows = (
      await tx.client.query<
        Omit<OfferItem, "expiresAt" | "holdUntil"> & {
          expiresAt: Date;
          holdUntil: Date | null;
        }
      >(
        `SELECT o.id,o.proposer_side AS "proposerSide",o.sku_id AS "skuId",o.publication_revision AS "publicationRevision",o.quantity,o.unit_price_minor AS "unitPriceMinor",CASE WHEN o.state='pending' AND o.expires_at<=statement_timestamp() THEN 'expired' ELSE o.state END AS state,o.revision,o.expires_at AS "expiresAt",o.sequence,coalesce((SELECT jsonb_agg(jsonb_build_object('kind',e.kind,'at',e.created_at) ORDER BY e.created_at,e.id) FROM treido.offer_events e WHERE e.offer_id=o.id AND e.kind IN ('expired','hold_expired')),'[]'::jsonb) AS "timerHistory",CASE WHEN a.state='active' AND a.expires_at<=statement_timestamp() THEN 'expired' ELSE a.state END AS "holdState",a.expires_at AS "holdUntil" FROM treido.listing_offers o LEFT JOIN treido.inventory_allocations a ON a.id=o.allocation_id WHERE o.thread_id=$1 AND ($2::int IS NULL OR o.sequence<$2) ORDER BY o.sequence DESC LIMIT $3`,
        [query.threadId, query.before, OFFER_LIMITS.page + 1],
      )
    ).rows;
    const selected = rows.slice(0, OFFER_LIMITS.page);
    return {
      actorKey: libraryActorKey(identity),
      threadId: query.threadId,
      revision,
      side: access.side,
      canNegotiate:
        access.mayNegotiate && !!inventory && inventory.mode !== "unknown",
      canCancel: access.mayManage,
      inventory,
      items: selected.map((row) => ({
        ...row,
        expiresAt: row.expiresAt.toISOString(),
        holdUntil: row.holdUntil?.toISOString() ?? null,
      })),
      olderBefore:
        rows.length > OFFER_LIMITS.page ? selected.at(-1)!.sequence : null,
    };
  });
}
type StoredOffer = {
  id: string;
  proposerSide: "buyer" | "seller";
  skuId: string;
  publicationRevision: number;
  quantity: number;
  unitPriceMinor: number;
  state: string;
  allocationId: string | null;
  live: boolean;
};
const storedColumns =
  'id,proposer_side AS "proposerSide",sku_id AS "skuId",publication_revision AS "publicationRevision",quantity,unit_price_minor AS "unitPriceMinor",state,allocation_id AS "allocationId",expires_at>clock_timestamp() AS live';
export async function changeOffer(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  return inTransaction(database, (tx) =>
    changeOfferInTransaction(tx, identity, raw),
  );
}
/** Reused by bulk cancellation: same allocation, events and notification transaction. */
export async function changeOfferInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseOfferCommand(raw),
    op = command.operation;
  const access = await offerAccess(
    tx,
    identity,
    command.threadId,
    { sellerId: command.sellerId },
    true,
  );
  const { thread, user, side } = access;
  if (!access.mayManage) throw new SellerError("FORBIDDEN");
  if (["propose", "accept", "reject"].includes(op.kind) && !access.mayNegotiate)
    throw new SellerError("NOT_AVAILABLE");
  const current = (
    await tx.client.query<{ revision: number; sequence: number }>(
      "SELECT offer_revision AS revision,next_sequence AS sequence FROM treido.conversation_threads WHERE id=$1 FOR UPDATE",
      [thread.id],
    )
  ).rows[0];
  const hash = inputHash(command);
  const previous = (
    await tx.client.query<{
      hash: string;
      revision: number;
      offerId: string;
    }>(
      'SELECT input_hash AS hash,accepted_revision AS revision,offer_id AS "offerId" FROM treido.offer_command_receipts WHERE thread_id=$1 AND actor_id=$2 AND request_id=$3',
      [thread.id, user.id, command.requestId],
    )
  ).rows[0];
  if (previous) {
    if (previous.hash !== hash || previous.revision !== current.revision)
      throw new SellerError("CONFLICT");
    return { revision: previous.revision, offerId: previous.offerId };
  }
  if (current.revision !== command.expectedRevision)
    throw new SellerError("CONFLICT");
  const targetId = op.kind === "propose" ? op.parentId : op.offerId;
  const target = targetId
    ? (
        await tx.client.query<StoredOffer>(
          "SELECT " +
            storedColumns +
            " FROM treido.listing_offers WHERE thread_id=$1 AND id=$2 FOR UPDATE",
          [thread.id, targetId],
        )
      ).rows[0]
    : null;
  if (targetId && !target) throw new SellerError("NOT_FOUND");
  let offerId: string, kind: OfferEventKind;
  if (op.kind === "propose") {
    if (!access.mayNegotiate) throw new SellerError("NOT_AVAILABLE");
    const inventory = await readPublicInventoryInTransaction(
        tx,
        thread.listingId,
        op.publicationRevision,
      ),
      sku = inventory?.skus.find((item) => item.id === op.skuId);
    if (
      !sku ||
      op.quantity > sku.available ||
      (inventory?.mode === "unique" && op.quantity !== 1)
    )
      throw new SellerError("CONFLICT");
    const held = await tx.client.query(
      "SELECT o.id FROM treido.listing_offers o JOIN treido.inventory_allocations a ON a.id=o.allocation_id WHERE o.thread_id=$1 AND a.state='active' AND a.expires_at>clock_timestamp() LIMIT 1",
      [thread.id],
    );
    if (held.rowCount) throw new SellerError("CONFLICT");
    await expirePendingOffersInTransaction(tx, thread.id);
    if (target) {
      if (
        target.state !== "pending" ||
        !target.live ||
        target.proposerSide === side ||
        target.skuId !== op.skuId ||
        target.publicationRevision !== op.publicationRevision ||
        target.quantity !== op.quantity
      )
        throw new SellerError("CONFLICT");
      const superseded = await tx.client.query(
        "UPDATE treido.listing_offers SET state='superseded',revision=revision+1 WHERE id=$1 AND state='pending' AND expires_at>clock_timestamp()",
        [target.id],
      );
      if (superseded.rowCount !== 1) throw new SellerError("CONFLICT");
    } else if (
      (
        await tx.client.query(
          "SELECT id FROM treido.listing_offers WHERE thread_id=$1 AND state='pending' LIMIT 1",
          [thread.id],
        )
      ).rowCount
    )
      throw new SellerError("CONFLICT");
    const count = (
      await tx.client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM treido.listing_offers WHERE thread_id=$1 AND created_at>clock_timestamp()-interval '1 hour'",
        [thread.id],
      )
    ).rows[0].count;
    if (count >= OFFER_LIMITS.perHour) throw new SellerError("QUOTA_EXCEEDED");
    offerId = randomUUID();
    kind = target ? "countered" : "created";
    await tx.client.query(
      "INSERT INTO treido.listing_offers(id,thread_id,seller_id,listing_id,buyer_id,proposer_id,proposer_side,publication_revision,sku_id,quantity,unit_price_minor,expires_at,sequence,parent_offer_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp()+make_interval(hours=>$12),$13,$14)",
      [
        offerId,
        thread.id,
        thread.sellerId,
        thread.listingId,
        thread.buyerId,
        user.id,
        side,
        op.publicationRevision,
        op.skuId,
        op.quantity,
        op.unitPriceMinor,
        op.expiresHours,
        current.sequence,
        target?.id ?? null,
      ],
    );
  } else {
    offerId = target!.id;
    if (op.kind === "cancel") {
      if (
        !access.mayManage ||
        target!.state !== "accepted" ||
        !target!.allocationId
      )
        throw new SellerError("CONFLICT");
      await releaseAllocation(tx, target!.allocationId, user.id, "cancelled");
      kind = "cancelled";
    } else {
      if (target!.state !== "pending" || !target!.live)
        throw new SellerError("CONFLICT");
      if (op.kind === "withdraw") {
        if (!access.mayManage || target!.proposerSide !== side)
          throw new SellerError("FORBIDDEN");
        kind = "withdrawn";
      } else {
        if (!access.mayNegotiate || target!.proposerSide === side)
          throw new SellerError("FORBIDDEN");
        if (op.kind === "accept") {
          const allocation = await allocateInventory(tx, {
            sellerId: thread.sellerId,
            buyerId: thread.buyerId,
            actorId: user.id,
            purpose: "offer",
            sourceId: offerId,
            lines: [
              {
                listingId: thread.listingId,
                skuId: target!.skuId,
                publicationRevision: target!.publicationRevision,
                quantity: target!.quantity,
                unitPriceMinor: target!.unitPriceMinor,
              },
            ],
          });
          const accepted = await tx.client.query(
            "UPDATE treido.listing_offers SET state='accepted',allocation_id=$2,revision=revision+1 WHERE id=$1 AND state='pending' AND expires_at>clock_timestamp()",
            [offerId, allocation.id],
          );
          if (accepted.rowCount !== 1) throw new SellerError("CONFLICT");
          kind = "accepted";
        } else kind = "rejected";
      }
    }
    if (kind !== "accepted") {
      const changed = await tx.client.query(
        "UPDATE treido.listing_offers SET state=$2,revision=revision+1 WHERE id=$1 AND ($2='cancelled' OR (state='pending' AND expires_at>clock_timestamp()))",
        [offerId, kind],
      );
      if (changed.rowCount !== 1) throw new SellerError("CONFLICT");
    }
  }
  const revision = current.revision + 1,
    eventId = randomUUID(),
    messageId = randomUUID();
  await tx.client.query(
    "INSERT INTO treido.offer_events(id,thread_id,offer_id,actor_id,kind) VALUES($1,$2,$3,$4,$5)",
    [eventId, thread.id, offerId, user.id, kind],
  );
  await tx.client.query(
    "INSERT INTO treido.messages(id,thread_id,author_id,sequence,body,request_id,input_hash,offer_event_id) VALUES($1,$2,$3,$4,'',$5,$6,$7)",
    [
      messageId,
      thread.id,
      user.id,
      current.sequence,
      command.requestId,
      hash,
      eventId,
    ],
  );
  await tx.client.query(
    "INSERT INTO treido.message_notification_intents(thread_id,message_id,recipient_side) VALUES($1,$2,$3)",
    [thread.id, messageId, side === "buyer" ? "seller" : "buyer"],
  );
  await tx.client.query(
    "UPDATE treido.conversation_threads SET offer_revision=$2,next_sequence=next_sequence+1,last_message_at=clock_timestamp() WHERE id=$1",
    [thread.id, revision],
  );
  await tx.client.query(
    "INSERT INTO treido.offer_command_receipts(thread_id,actor_id,request_id,input_hash,accepted_revision,offer_id) VALUES($1,$2,$3,$4,$5,$6)",
    [thread.id, user.id, command.requestId, hash, revision, offerId],
  );
  return { revision, offerId };
}

/** Historical per-row acknowledgment around the existing cancellation command.
 * Current participant AND stock-management authority is checked even on replay. */
export async function cancelReservedOfferInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  command: import("../purchase-reviews/bulk-model").CancellationCommand,
): Promise<import("../purchase-reviews/bulk-model").CancellationReceipt> {
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  const access = await offerAccess(
    tx,
    identity,
    command.threadId,
    { sellerId: command.sellerId },
    true,
  );
  if (!access.mayManage) throw new SellerError("FORBIDDEN");
  // offerAccess follows the existing buyer -> seller -> contact -> listing ->
  // thread lock order, so concurrent accept/cancel/stock edits stay serialized.
  const hash = inputHash(command);
  const prior = (
    await tx.client.query<{ hash: string; revision: number }>(
      "SELECT input_hash AS hash,accepted_revision AS revision FROM treido.reservation_cancellation_receipts WHERE actor_id=$1 AND request_id=$2",
      [access.user.id, command.requestId],
    )
  ).rows[0];
  const receipt = (revision: number) => ({
    allocationId: command.allocationId,
    offerId: command.offerId,
    threadId: command.threadId,
    requestId: command.requestId,
    revision,
  });
  if (prior) {
    if (prior.hash !== hash) throw new SellerError("CONFLICT");
    return receipt(prior.revision);
  }
  const target = await tx.client.query(
    "SELECT id FROM treido.listing_offers WHERE id=$1 AND thread_id=$2 AND seller_id=$3 AND allocation_id=$4 AND state='accepted'",
    [
      command.offerId,
      command.threadId,
      access.thread.sellerId,
      command.allocationId,
    ],
  );
  if (target.rowCount !== 1) throw new SellerError("CONFLICT");
  const result = await changeOfferInTransaction(tx, identity, {
    sellerId: command.sellerId,
    threadId: command.threadId,
    expectedRevision: command.expectedRevision,
    requestId: command.requestId,
    operation: { kind: "cancel", offerId: command.offerId },
  });
  await tx.client.query(
    "INSERT INTO treido.reservation_cancellation_receipts(actor_id,request_id,seller_id,operating_seller_id,allocation_id,thread_id,offer_id,input_hash,accepted_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      access.user.id,
      command.requestId,
      access.thread.sellerId,
      command.sellerId,
      command.allocationId,
      command.threadId,
      command.offerId,
      hash,
      result.revision,
    ],
  );
  return receipt(result.revision);
}
