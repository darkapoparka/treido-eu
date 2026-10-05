import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { reservedSql } from "./queries.server";
import { parseInventoryIndexQuery, type InventoryIndex } from "./index-model";
export async function readInventoryIndex(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  raw: unknown,
): Promise<InventoryIndex> {
  const query = parseInventoryIndexQuery(raw);
  return inTransaction(database, async (tx) => {
    const access = await authorizeSeller(
      tx,
      identity,
      sellerId,
      "listing.read",
    );
    const key = createHmac("sha256", publicDiscoveryKey())
      .update(
        "inventory-index-v1:" +
          inputHash({
            actor: access.user.id,
            sellerId,
            q: query.q,
            status: query.status,
          }),
      )
      .digest();
    const sign = (text: string) =>
      createHmac("sha256", key).update(text).digest();
    let after: { listing: string; sku: string } | null = null;
    if (query.cursor) {
      try {
        const [encoded, mac, ...extra] = query.cursor.split("."),
          signature = Buffer.from(mac, "base64url");
        if (
          extra.length ||
          signature.length !== 32 ||
          !timingSafeEqual(signature, sign(encoded))
        )
          throw Error();
        const parsed = JSON.parse(
          Buffer.from(encoded, "base64url").toString("utf8"),
        );
        if (
          Object.keys(parsed).sort().join(",") !== "listing,sku" ||
          !validId(parsed.listing) ||
          !validId(parsed.sku)
        )
          throw Error();
        after = parsed;
      } catch {
        throw new SellerError("INVALID_INPUT");
      }
    }
    const row = (
      await tx.client.query<{ total: number; items: InventoryIndex["items"] }>(
        'WITH stock AS MATERIALIZED (SELECT l.id AS "listingId",i.id AS "skuId",coalesce(d.payload->>\'title\',\'\') AS title,coalesce(i.seller_sku,\'\') AS "sellerSku",coalesce(i.options,\'{}\'::jsonb) AS options,c.mode,c.revision AS "inventoryRevision",i.on_hand AS "onHand",' +
          reservedSql("i.id") +
          " AS reserved,CASE WHEN i.id IS NULL THEN NULL ELSE greatest(0,i.on_hand-" +
          reservedSql("i.id") +
          ') END AS available FROM treido.listings l JOIN treido.listing_drafts d ON d.seller_id=l.seller_id AND d.listing_id=l.id LEFT JOIN treido.inventory_catalogues c ON c.seller_id=l.seller_id AND c.listing_id=l.id LEFT JOIN treido.inventory_skus i ON i.seller_id=l.seller_id AND i.listing_id=l.id AND i.active WHERE l.seller_id=$1 AND (strpos(lower(coalesce(d.payload->>\'title\',\'\')),lower($2))>0 OR strpos(lower(coalesce(i.seller_sku,\'\')),lower($2))>0)), classified AS (SELECT *,CASE WHEN mode IS NULL THEN \'unknown\' WHEN available>0 THEN \'available\' WHEN "onHand">0 THEN \'reserved\' ELSE \'out_of_stock\' END AS state FROM stock), matched AS MATERIALIZED (SELECT * FROM classified WHERE $3=\'all\' OR state=$3), page AS (SELECT * FROM matched WHERE ($4::uuid IS NULL OR ("listingId",coalesce("skuId","listingId"))>($4::uuid,$5::uuid)) ORDER BY "listingId",coalesce("skuId","listingId") LIMIT 31) SELECT (SELECT count(*)::int FROM matched) AS total,coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY "listingId",coalesce("skuId","listingId")) FROM page),\'[]\'::jsonb) AS items',
        [
          sellerId,
          query.q,
          query.status,
          after?.listing ?? null,
          after?.sku ?? null,
        ],
      )
    ).rows[0];
    const selected = row.items.slice(0, 30),
      last = selected.at(-1);
    let nextCursor: string | null = null;
    if (row.items.length > 30 && last) {
      const encoded = Buffer.from(
        JSON.stringify({
          listing: last.listingId,
          sku: last.skuId ?? last.listingId,
        }),
      ).toString("base64url");
      nextCursor = encoded + "." + sign(encoded).toString("base64url");
    }
    return {
      sellerId,
      query,
      total: row.total,
      items: selected,
      nextCursor,
      canManage: access.context.capabilities.includes(
        access.seller.kind === "personal"
          ? "listing.write"
          : "inventory.manage",
      ),
    };
  });
}
