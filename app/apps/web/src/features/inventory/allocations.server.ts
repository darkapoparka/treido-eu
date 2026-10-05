import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import {
  publishedEligibility,
  publishedJoins,
} from "../catalog/publication-eligibility.server";
import { INVENTORY_LIMITS, whole } from "./model";
import { reservedSql, paymentRiskSql } from "./queries.server";
import { stockEvent } from "./commands.server";
export type AllocationLine = {
  listingId: string;
  skuId: string;
  publicationRevision: number;
  quantity: number;
  unitPriceMinor: number;
};
export type Allocation = {
  id: string;
  sellerId: string;
  buyerId: string;
  purpose: "offer" | "checkout";
  sourceId: string;
  state: "active" | "released" | "expired" | "consumed" | "reconciliation";
  expiresAt: Date;
  revision: number;
  inputHash: string;
  resolutionReference: string | null;
};
const columns =
  'id,seller_id AS "sellerId",buyer_id AS "buyerId",purpose,source_id AS "sourceId",state,expires_at AS "expiresAt",revision,input_hash AS "inputHash",resolution_reference AS "resolutionReference"';
export async function lockInventoryListings(
  tx: SellerTransaction,
  sellerId: string,
  ids: string[],
) {
  const sorted = [...new Set(ids)].sort();
  const rows = await tx.client.query(
    "SELECT id FROM treido.listings WHERE seller_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",
    [sellerId, sorted],
  );
  if (rows.rowCount !== sorted.length) throw new SellerError("NOT_FOUND");
}
async function linesFor(
  tx: SellerTransaction,
  id: string,
): Promise<AllocationLine[]> {
  return (
    await tx.client.query<AllocationLine>(
      'SELECT listing_id AS "listingId",sku_id AS "skuId",publication_revision AS "publicationRevision",quantity,unit_price_minor AS "unitPriceMinor" FROM treido.inventory_allocation_lines WHERE allocation_id=$1 ORDER BY listing_id,sku_id',
      [id],
    )
  ).rows;
}
/** Internal transaction primitive. Offer acceptance and future qualified checkout share it.
 * Callers authenticate and authorize their durable source BEFORE invoking this function.
 * Never expose buyerId/sourceId as a browser authority or reserve from a cart read. */
export async function allocateInventory(
  tx: SellerTransaction,
  input: {
    sellerId: string;
    buyerId: string;
    actorId: string;
    purpose: "offer" | "checkout";
    sourceId: string;
    lines: AllocationLine[];
  },
): Promise<Allocation> {
  if (
    ![input.sellerId, input.buyerId, input.actorId, input.sourceId].every(
      validId,
    ) ||
    !["offer", "checkout"].includes(input.purpose) ||
    !Array.isArray(input.lines) ||
    !input.lines.length ||
    input.lines.length > INVENTORY_LIMITS.lines ||
    new Set(input.lines.map((line) => line.skuId)).size !==
      input.lines.length ||
    input.lines.some(
      (line) =>
        !validId(line.listingId) ||
        !validId(line.skuId) ||
        !whole(line.quantity, 1, INVENTORY_LIMITS.quantity) ||
        !whole(line.publicationRevision, 2, 2147483646) ||
        !whole(line.unitPriceMinor, 0, 1_000_000_000),
    )
  )
    throw new SellerError("INVALID_INPUT");
  const lines = [...input.lines].sort(
    (a, b) =>
      a.listingId.localeCompare(b.listingId) || a.skuId.localeCompare(b.skuId),
  );
  const buyer = await tx.client.query(
    "SELECT id FROM treido.users WHERE id=$1 AND status='active' FOR SHARE",
    [input.buyerId],
  );
  if (buyer.rowCount !== 1) throw new SellerError("FORBIDDEN");
  const seller = await tx.client.query(
    "SELECT id FROM treido.seller_accounts WHERE id=$1 AND status='active' FOR SHARE",
    [input.sellerId],
  );
  if (seller.rowCount !== 1) throw new SellerError("NOT_AVAILABLE");
  const self = await tx.client.query(
    "SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'",
    [input.sellerId, input.buyerId],
  );
  if (self.rowCount) throw new SellerError("FORBIDDEN");
  await lockInventoryListings(
    tx,
    input.sellerId,
    lines.map((line) => line.listingId),
  );
  const hash = inputHash({
    sellerId: input.sellerId,
    buyerId: input.buyerId,
    purpose: input.purpose,
    sourceId: input.sourceId,
    lines,
  });
  const previous = (
    await tx.client.query<Allocation>(
      "SELECT " +
        columns +
        " FROM treido.inventory_allocations WHERE purpose=$1 AND source_id=$2 FOR UPDATE",
      [input.purpose, input.sourceId],
    )
  ).rows[0];
  // Recheck publication even on a repeated internal call. Replays never renew a hold.
  for (const line of lines) {
    const eligible = await tx.client.query(
      "SELECT l.id " +
        publishedJoins +
        " WHERE l.id=$1 AND l.seller_id=$2 AND p.revision=$3 AND " +
        publishedEligibility,
      [line.listingId, input.sellerId, line.publicationRevision],
    );
    if (eligible.rowCount !== 1) throw new SellerError("NOT_AVAILABLE");
  }
  if (previous) {
    const live = await tx.client.query(
      "SELECT id FROM treido.inventory_allocations WHERE id=$1 AND expires_at>clock_timestamp() AND state='active'",
      [previous.id],
    );
    if (previous.inputHash !== hash || live.rowCount !== 1)
      throw new SellerError("CONFLICT");
    return previous;
  }
  const stocks: { line: AllocationLine; onHand: number }[] = [];
  for (const line of lines) {
    const sku = (
      await tx.client.query<{
        onHand: number;
        available: number;
        mode: string;
        priceMinor: number;
      }>(
        `SELECT i.on_hand AS "onHand",i.mode,ps.price_minor AS "priceMinor",i.on_hand-${reservedSql("i.id")} AS available FROM treido.inventory_skus i JOIN treido.inventory_publication_skus ps ON ps.seller_id=i.seller_id AND ps.listing_id=i.listing_id AND ps.sku_id=i.id WHERE i.id=$1 AND i.seller_id=$2 AND i.listing_id=$3 AND ps.publication_revision=$4 AND i.active FOR UPDATE OF i`,
        [line.skuId, input.sellerId, line.listingId, line.publicationRevision],
      )
    ).rows[0];
    if (
      !sku ||
      sku.available < line.quantity ||
      (sku.mode === "unique" && line.quantity !== 1)
    )
      throw new SellerError("CONFLICT");
    if (input.purpose === "checkout" && sku.priceMinor !== line.unitPriceMinor)
      throw new SellerError("CONFLICT");
    stocks.push({ line, onHand: sku.onHand });
  }
  const seconds =
    input.purpose === "offer"
      ? INVENTORY_LIMITS.offerSeconds
      : INVENTORY_LIMITS.checkoutSeconds;
  const allocation = (
    await tx.client.query<Allocation>(
      "INSERT INTO treido.inventory_allocations(id,seller_id,buyer_id,purpose,source_id,input_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,clock_timestamp()+make_interval(secs=>$7)) RETURNING " +
        columns,
      [
        randomUUID(),
        input.sellerId,
        input.buyerId,
        input.purpose,
        input.sourceId,
        hash,
        seconds,
      ],
    )
  ).rows[0];
  for (const { line, onHand } of stocks) {
    await tx.client.query(
      "INSERT INTO treido.inventory_allocation_lines(allocation_id,seller_id,listing_id,sku_id,publication_revision,quantity,unit_price_minor,currency) VALUES($1,$2,$3,$4,$5,$6,$7,'EUR')",
      [
        allocation.id,
        input.sellerId,
        line.listingId,
        line.skuId,
        line.publicationRevision,
        line.quantity,
        line.unitPriceMinor,
      ],
    );
    await stockEvent(tx, {
      sellerId: input.sellerId,
      listingId: line.listingId,
      skuId: line.skuId,
      actorId: input.actorId,
      allocationId: allocation.id,
      kind: "reserve",
      quantity: line.quantity,
      onHand,
      reason: input.purpose,
    });
  }
  return allocation;
}
/** Call before other allocation locks, in the same seller/listing lock order as allocate. */
export async function lockAllocation(tx: SellerTransaction, id: string) {
  if (!validId(id)) throw new SellerError("INVALID_INPUT");
  const initial = (
    await tx.client.query<Allocation>(
      "SELECT " + columns + " FROM treido.inventory_allocations WHERE id=$1",
      [id],
    )
  ).rows[0];
  if (!initial) throw new SellerError("NOT_FOUND");
  await tx.client.query(
    "SELECT id FROM treido.seller_accounts WHERE id=$1 FOR SHARE",
    [initial.sellerId],
  );
  const lines = await linesFor(tx, id);
  await lockInventoryListings(
    tx,
    initial.sellerId,
    lines.map((line) => line.listingId),
  );
  await tx.client.query(
    "SELECT id FROM treido.inventory_skus WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
    [lines.map((line) => line.skuId)],
  );
  const allocation = (
    await tx.client.query<Allocation>(
      "SELECT " +
        columns +
        " FROM treido.inventory_allocations WHERE id=$1 FOR UPDATE",
      [id],
    )
  ).rows[0];
  return { allocation, lines };
}
export async function releaseAllocation(
  tx: SellerTransaction,
  id: string,
  actorId: string | null,
  reason: "cancelled" | "expired",
) {
  const { allocation, lines } = await lockAllocation(tx, id);
  if (["released", "expired"].includes(allocation.state)) return allocation;
  if (allocation.state !== "active") throw new SellerError("CONFLICT");
  const risk = await tx.client.query(
    `SELECT id FROM treido.inventory_allocations a WHERE a.id=$1 AND ${paymentRiskSql("a.id")}`,
    [id],
  );
  if (risk.rowCount) {
    if (reason === "cancelled") throw new SellerError("CONFLICT");
    return allocation;
  }
  const result = await tx.client.query<Allocation>(
    "UPDATE treido.inventory_allocations SET state=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 AND ($2<>'expired' OR expires_at<=clock_timestamp()) RETURNING " +
      columns,
    [id, reason === "expired" ? "expired" : "released"],
  );
  if (!result.rowCount) return allocation;
  for (const line of lines) {
    const stock = (
      await tx.client.query<{ onHand: number }>(
        'SELECT on_hand AS "onHand" FROM treido.inventory_skus WHERE id=$1',
        [line.skuId],
      )
    ).rows[0];
    await stockEvent(tx, {
      ...line,
      sellerId: allocation.sellerId,
      actorId,
      allocationId: id,
      kind: reason === "expired" ? "expire" : "release",
      quantity: -line.quantity,
      onHand: stock.onHand,
      reason,
    });
  }
  return result.rows[0];
}
/** Provider-only settlement seam: a late success is quarantined, never takes someone else's stock.
 * Not a Server Action and not reachable from a client payment redirect. */
export async function settleAllocation(
  tx: SellerTransaction,
  id: string,
  verifiedReference: string,
  qualified = true,
) {
  if (
    typeof verifiedReference !== "string" ||
    !/^[A-Za-z0-9:_-]{3,200}$/.test(verifiedReference)
  )
    throw new SellerError("INVALID_INPUT");
  const { allocation, lines } = await lockAllocation(tx, id);
  if (["consumed", "reconciliation"].includes(allocation.state)) {
    if (allocation.resolutionReference !== verifiedReference)
      throw new SellerError("CONFLICT");
    return allocation.state;
  }
  const stillLive =
    (
      await tx.client.query(
        "SELECT id FROM treido.inventory_allocations WHERE id=$1 AND state='active' AND expires_at>clock_timestamp()",
        [id],
      )
    ).rowCount === 1;
  let valid = stillLive && qualified;
  for (const line of lines) {
    const row = await tx.client.query(
      "SELECT l.id " +
        publishedJoins +
        " JOIN treido.inventory_skus i ON i.listing_id=l.id AND i.seller_id=l.seller_id WHERE l.id=$1 AND i.id=$2 AND i.active AND i.on_hand>=$3 AND p.revision=$4 AND " +
        publishedEligibility,
      [line.listingId, line.skuId, line.quantity, line.publicationRevision],
    );
    if (row.rowCount !== 1) valid = false;
  }
  const state = valid ? "consumed" : "reconciliation";
  await tx.client.query(
    "UPDATE treido.inventory_allocations SET state=$2,resolution_reference=$3,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
    [id, state, verifiedReference],
  );
  for (const line of lines) {
    const row = valid
      ? (
          await tx.client.query<{ onHand: number }>(
            'UPDATE treido.inventory_skus SET on_hand=on_hand-$2,sold=sold+$2,revision=revision+1 WHERE id=$1 RETURNING on_hand AS "onHand"',
            [line.skuId, line.quantity],
          )
        ).rows[0]
      : (
          await tx.client.query<{ onHand: number }>(
            'SELECT on_hand AS "onHand" FROM treido.inventory_skus WHERE id=$1',
            [line.skuId],
          )
        ).rows[0];
    await stockEvent(tx, {
      ...line,
      sellerId: allocation.sellerId,
      allocationId: id,
      kind: valid ? "consume" : "reconcile",
      quantity: valid ? -line.quantity : 0,
      onHand: row.onHand,
      reason: "provider_settlement",
    });
  }
  if (valid)
    await tx.client.query(
      "UPDATE treido.inventory_catalogues SET revision=revision+1 WHERE seller_id=$1 AND listing_id=ANY($2::uuid[])",
      [allocation.sellerId, [...new Set(lines.map((line) => line.listingId))]],
    );
  return state;
}
export async function expireInventoryAllocations(
  database: SellerDatabase,
  limit = 50,
) {
  if (!whole(limit, 1, 100)) throw new SellerError("INVALID_INPUT");
  const candidates = (
    await database.pool.query<{ id: string }>(
      `SELECT a.id FROM treido.inventory_allocations a WHERE a.state='active' AND a.expires_at<=clock_timestamp() AND NOT ${paymentRiskSql("a.id")} ORDER BY a.expires_at,a.id LIMIT $1`,
      [limit],
    )
  ).rows;
  let expired = 0;
  for (const row of candidates) {
    const result = await inTransaction(database, (tx) =>
      releaseAllocation(tx, row.id, null, "expired"),
    );
    if (result.state === "expired") expired++;
  }
  return { examined: candidates.length, expired };
}
