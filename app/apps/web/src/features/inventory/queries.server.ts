import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { readFreeCatalogueLimits } from "../sellers/free-catalogue.server";
import { SellerError } from "../sellers/errors";
import {
  publishedEligibility,
  publishedJoins,
} from "../catalog/publication-eligibility.server";
import {
  INVENTORY_LIMITS,
  parseInventoryScope,
  stockState,
  type InventoryEventKind,
  type InventoryMode,
  type InventorySku,
  type InventoryView,
  type PublicInventory,
  type PublicSku,
} from "./model";

/** Only fixed application SQL expressions may be passed; never request strings. */
export function reservedSql(sku: string) {
  return `coalesce((SELECT sum(al.quantity)::int FROM treido.inventory_allocation_lines al JOIN treido.inventory_allocations a ON a.id=al.allocation_id WHERE al.sku_id=${sku} AND a.state='active' AND (a.expires_at>statement_timestamp() OR ${paymentRiskSql("a.id")})),0)`;
}
/** A provider effect can outlive the immutable hold deadline. Quarantine its
 * stock until signed reconciliation proves terminal cancellation or settlement;
 * this never changes expires_at or authorizes another payment/allocation. */
export function paymentRiskSql(allocation: string) {
  return `EXISTS(SELECT 1 FROM treido.payable_quotes pq JOIN treido.payment_attempts pa ON pa.quote_id=pq.id WHERE pq.allocation_id=${allocation} AND pa.state NOT IN ('prepared','cancelled'))`;
}
export async function inventoryAccess(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string,
  listingId: string,
  write = false,
) {
  const access = await authorizeSeller(tx, identity, sellerId, "listing.read");
  if (write)
    await authorizeSeller(
      tx,
      identity,
      sellerId,
      access.seller.kind === "personal" ? "listing.write" : "inventory.manage",
    );
  const limits = await readFreeCatalogueLimits(
    tx,
    sellerId,
    access.seller.kind,
    write,
  );
  const listing = (
    await tx.client.query<{
      revision: number;
      publication: string;
      moderation: string;
      title: string;
    }>(
      `SELECT l.revision,l.publication,l.moderation_state AS moderation,coalesce(d.payload->>'title','') AS title FROM treido.listings l JOIN treido.listing_drafts d ON d.listing_id=l.id AND d.seller_id=l.seller_id WHERE l.seller_id=$1 AND l.id=$2 FOR ${write ? "UPDATE" : "SHARE"} OF l`,
      [sellerId, listingId],
    )
  ).rows[0];
  if (!listing) throw new SellerError("NOT_FOUND");
  if (write && listing.moderation !== "clear")
    throw new SellerError("NOT_AVAILABLE");
  return { ...access, listing, limits };
}
export async function readInventory(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<InventoryView> {
  const { sellerId, listingId } = parseInventoryScope(raw);
  return inTransaction(database, async (tx) => {
    const access = await inventoryAccess(tx, identity, sellerId, listingId);
    const catalogue = (
      await tx.client.query<{ mode: InventoryMode; revision: number }>(
        "SELECT mode,revision FROM treido.inventory_catalogues WHERE seller_id=$1 AND listing_id=$2",
        [sellerId, listingId],
      )
    ).rows[0];
    const skus = (
      await tx.client.query<InventorySku>(
        `SELECT i.id,i.seller_sku AS "sellerSku",i.options,i.price_minor AS "priceMinor",i.on_hand AS "onHand",i.sold,i.revision,${reservedSql("i.id")} AS reserved,greatest(0,i.on_hand-${reservedSql("i.id")}) AS available FROM treido.inventory_skus i WHERE i.seller_id=$1 AND i.listing_id=$2 AND i.active ORDER BY i.created_at,i.id LIMIT $3`,
        [sellerId, listingId, INVENTORY_LIMITS.skus],
      )
    ).rows;
    const events = (
      await tx.client.query<{
        id: string;
        skuId: string;
        kind: InventoryEventKind;
        quantity: number;
        onHandAfter: number;
        reason: string;
        createdAt: Date;
      }>(
        'SELECT id,sku_id AS "skuId",kind,quantity,on_hand_after AS "onHandAfter",reason,created_at AS "createdAt" FROM treido.inventory_events WHERE seller_id=$1 AND listing_id=$2 ORDER BY created_at DESC,id DESC LIMIT $3',
        [sellerId, listingId, INVENTORY_LIMITS.history],
      )
    ).rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
    const canManage =
      access.context.capabilities.includes(
        access.seller.kind === "personal"
          ? "listing.write"
          : "inventory.manage",
      ) && access.listing.moderation === "clear";
    return {
      sellerId,
      listingId,
      listingRevision: access.listing.revision,
      title: access.listing.title,
      kind: access.seller.kind,
      mode: catalogue?.mode ?? null,
      maxVariants: access.limits.variants,
      revision: catalogue?.revision ?? 0,
      canManage,
      canDefine: canManage && access.listing.publication !== "published",
      skus,
      events,
    };
  });
}
export async function readPublicInventoryInTransaction(
  tx: Pick<SellerTransaction, "client">,
  listingId: string,
  expectedRevision?: number,
): Promise<PublicInventory | null> {
  const row = (
    await tx.client.query<{ revision: number; mode: InventoryMode | null }>(
      "SELECT p.revision,ip.mode " +
        publishedJoins +
        " LEFT JOIN treido.inventory_publications ip ON ip.seller_id=l.seller_id AND ip.listing_id=l.id AND ip.publication_revision=p.revision WHERE l.id=$1 AND ($2::integer IS NULL OR p.revision=$2) AND " +
        publishedEligibility,
      [listingId, expectedRevision ?? null],
    )
  ).rows[0];
  if (!row) return null;
  const skus = row.mode
    ? (
        await tx.client.query<PublicSku>(
          `SELECT ps.sku_id AS id,ps.options,ps.price_minor AS "priceMinor",CASE WHEN i.active THEN i.on_hand ELSE 0 END AS "onHand",CASE WHEN i.active THEN greatest(0,i.on_hand-${reservedSql("i.id")}) ELSE 0 END AS available FROM treido.inventory_publication_skus ps JOIN treido.inventory_skus i ON i.seller_id=ps.seller_id AND i.listing_id=ps.listing_id AND i.id=ps.sku_id WHERE ps.listing_id=$1 AND ps.publication_revision=$2 ORDER BY ps.sku_id LIMIT $3`,
          [listingId, row.revision, INVENTORY_LIMITS.skus],
        )
      ).rows
    : [];
  return {
    publicationRevision: row.revision,
    mode: row.mode ?? "unknown",
    state: stockState(skus, !!row.mode),
    skus,
  };
}
export async function readPublicInventory(
  database: SellerDatabase,
  listingId: string,
  revision?: number,
) {
  return inTransaction(database, (tx) =>
    readPublicInventoryInTransaction(tx, listingId, revision),
  );
}
/** Snapshot definitions, not physical quantities. Stock remains current at every read/claim. */
export async function snapshotInventory(
  tx: SellerTransaction,
  sellerId: string,
  listingId: string,
  publicationRevision: number,
  basePrice: number,
) {
  const catalogue = (
    await tx.client.query<{
      mode: InventoryMode;
      revision: number;
      kind: "personal" | "business";
    }>(
      "SELECT mode,revision,seller_kind AS kind FROM treido.inventory_catalogues WHERE seller_id=$1 AND listing_id=$2 FOR SHARE",
      [sellerId, listingId],
    )
  ).rows[0];
  if (!catalogue) return;
  const limits = await readFreeCatalogueLimits(tx, sellerId, catalogue.kind);
  const rows = (
    await tx.client.query<{ id: string }>(
      "SELECT id FROM treido.inventory_skus WHERE seller_id=$1 AND listing_id=$2 AND active ORDER BY id FOR SHARE",
      [sellerId, listingId],
    )
  ).rows;
  if (
    !rows.length ||
    rows.length > limits.variants ||
    (catalogue.mode === "unique" && rows.length !== 1)
  )
    throw new SellerError("INVALID_INPUT");
  await tx.client.query(
    "INSERT INTO treido.inventory_publications(seller_id,listing_id,publication_revision,mode,inventory_revision) VALUES($1,$2,$3,$4,$5)",
    [
      sellerId,
      listingId,
      publicationRevision,
      catalogue.mode,
      catalogue.revision,
    ],
  );
  await tx.client.query(
    "INSERT INTO treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id,options,price_minor,currency) SELECT seller_id,listing_id,$3,id,options,coalesce(price_minor,$4),'EUR' FROM treido.inventory_skus WHERE seller_id=$1 AND listing_id=$2 AND active",
    [sellerId, listingId, publicationRevision, basePrice],
  );
}
