import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import {
  publishedJoins,
  publishedEligibility,
} from "../catalog/publication-eligibility.server";
import {
  readPublicInventoryInTransaction,
  reservedSql,
} from "../inventory/queries.server";
import {
  CART_LIMITS,
  parseCartCommand,
  type BuyerCart,
  type CartItem,
} from "./model";
export async function readBuyerCart(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<BuyerCart> {
  return inTransaction(database, async (tx) => {
    const result: BuyerCart = {
      actorKey: libraryActorKey(identity),
      revision: 0,
      lines: [],
    };
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return result;
      throw error;
    }
    result.revision =
      (
        await tx.client.query<{ revision: number }>(
          "SELECT revision FROM treido.buyer_carts WHERE user_id=$1",
          [user.id],
        )
      ).rows[0]?.revision ?? 0;
    const rows = (
      await tx.client.query<{
        skuId: string;
        quantity: number;
        seenPrice: number;
        seenRevision: number;
        item: CartItem | null;
      }>(
        `SELECT b.sku_id AS "skuId",b.quantity,b.seen_price_minor AS "seenPrice",b.publication_revision AS "seenRevision",public.item FROM treido.buyer_cart_lines b LEFT JOIN LATERAL (
        SELECT jsonb_build_object('listingId',l.id,'skuId',ps.sku_id,'sellerId',s.id,'sellerName',s.name,'title',p.payload->>'title','photo','/api/listing-media/' || l.id || '/' || (SELECT pm.asset_id FROM treido.listing_publication_media pm WHERE pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision ORDER BY pm.position LIMIT 1) || '?v=' || p.revision,'options',ps.options,'mode',i.mode,'publicationRevision',p.revision,'priceMinor',ps.price_minor,'available',greatest(0,i.on_hand-${reservedSql("i.id")})) AS item
        ${publishedJoins} JOIN treido.inventory_publication_skus ps ON ps.seller_id=l.seller_id AND ps.listing_id=l.id AND ps.publication_revision=p.revision JOIN treido.inventory_skus i ON i.seller_id=ps.seller_id AND i.listing_id=ps.listing_id AND i.id=ps.sku_id
        WHERE l.id=b.listing_id AND ps.sku_id=b.sku_id AND i.active AND ${publishedEligibility}
      ) public ON true WHERE b.user_id=$1 AND b.active ORDER BY b.added_at DESC,b.sku_id LIMIT $2`,
        [user.id, CART_LIMITS.lines],
      )
    ).rows;
    result.lines = rows.map((row) => ({
      skuId: row.skuId,
      quantity: row.quantity,
      item: row.item,
      state: !row.item
        ? "unavailable"
        : row.seenRevision !== row.item.publicationRevision ||
            row.seenPrice !== row.item.priceMinor
          ? "changed"
          : row.quantity > row.item.available
            ? "shortage"
            : "ready",
    }));
    return result;
  });
}
export async function changeBuyerCart(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseCartCommand(raw),
    op = command.operation;
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, true);
    await tx.client.query(
      "INSERT INTO treido.buyer_carts(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [user.id],
    );
    const cart = (
      await tx.client.query<{ revision: number }>(
        "SELECT revision FROM treido.buyer_carts WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    const hash = inputHash(command);
    const prior = (
      await tx.client.query<{ hash: string; revision: number }>(
        "SELECT input_hash AS hash,accepted_revision AS revision FROM treido.buyer_cart_receipts WHERE user_id=$1 AND request_id=$2",
        [user.id, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.hash !== hash || prior.revision !== cart.revision)
        throw new SellerError("CONFLICT");
      return { revision: prior.revision };
    }
    if (cart.revision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    if (op.kind === "remove")
      await tx.client.query(
        "UPDATE treido.buyer_cart_lines SET active=false WHERE user_id=$1 AND sku_id=$2",
        [user.id, op.skuId],
      );
    else {
      const owner = (
        await tx.client.query<{ sellerId: string }>(
          'SELECT seller_id AS "sellerId" FROM treido.listings WHERE id=$1',
          [op.listingId],
        )
      ).rows[0];
      if (!owner) throw new SellerError("NOT_FOUND");
      await tx.client.query(
        "SELECT id FROM treido.seller_accounts WHERE id=$1 FOR SHARE",
        [owner.sellerId],
      );
      await tx.client.query(
        "SELECT id FROM treido.listings WHERE id=$1 FOR SHARE",
        [op.listingId],
      );
      const self = await tx.client.query(
        "SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'",
        [owner.sellerId, user.id],
      );
      if (self.rowCount) throw new SellerError("FORBIDDEN");
      const inventory = await readPublicInventoryInTransaction(
          tx,
          op.listingId,
          op.publicationRevision,
        ),
        sku = inventory?.skus.find((row) => row.id === op.skuId);
      if (!inventory || !sku) throw new SellerError("NOT_AVAILABLE");
      const existing = (
        await tx.client.query<{ quantity: number; revision: number }>(
          "SELECT quantity,publication_revision AS revision FROM treido.buyer_cart_lines WHERE user_id=$1 AND sku_id=$2 AND active",
          [user.id, op.skuId],
        )
      ).rows[0];
      if (
        existing &&
        op.kind === "add" &&
        existing.revision !== op.publicationRevision
      )
        throw new SellerError("CONFLICT");
      const quantity =
        op.quantity + (op.kind === "add" ? (existing?.quantity ?? 0) : 0);
      if (
        quantity > (inventory.mode === "unique" ? 1 : CART_LIMITS.quantity) ||
        quantity > sku.available
      )
        throw new SellerError("CONFLICT");
      const count = (
        await tx.client.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM treido.buyer_cart_lines WHERE user_id=$1 AND active",
          [user.id],
        )
      ).rows[0].count;
      if (!existing && count >= CART_LIMITS.lines)
        throw new SellerError("QUOTA_EXCEEDED");
      await tx.client.query(
        "INSERT INTO treido.buyer_cart_lines(user_id,seller_id,listing_id,sku_id,publication_revision,quantity,seen_price_minor) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,sku_id) DO UPDATE SET publication_revision=excluded.publication_revision,quantity=excluded.quantity,seen_price_minor=excluded.seen_price_minor,active=true,added_at=clock_timestamp()",
        [
          user.id,
          owner.sellerId,
          op.listingId,
          op.skuId,
          op.publicationRevision,
          quantity,
          sku.priceMinor,
        ],
      );
    }
    const revision = cart.revision + 1;
    await tx.client.query(
      "UPDATE treido.buyer_carts SET revision=$2 WHERE user_id=$1",
      [user.id, revision],
    );
    await tx.client.query(
      "INSERT INTO treido.buyer_cart_receipts(user_id,request_id,input_hash,accepted_revision) VALUES($1,$2,$3,$4)",
      [user.id, command.requestId, hash, revision],
    );
    return { revision };
  });
}
