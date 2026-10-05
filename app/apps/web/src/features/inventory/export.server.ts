import "server-only";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { csvDocument } from "../catalogue-import/csv";
import { readInventoryIndex } from "./index.server";
/** Export only the named, currently authorized page; no browser-authored stock values. */
export async function exportInventoryPage(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  raw: unknown,
) {
  const page = await readInventoryIndex(database, identity, sellerId, raw);
  return {
    count: page.items.length,
    csv: csvDocument(
      [
        "listing_id",
        "sku_id",
        "title",
        "seller_sku",
        "options_json",
        "inventory_mode",
        "on_hand",
        "reserved",
        "available",
        "state",
      ],
      page.items.map((row) => [
        row.listingId,
        row.skuId,
        row.title,
        row.sellerSku,
        JSON.stringify(row.options),
        row.mode,
        row.onHand,
        row.reserved,
        row.available,
        row.state,
      ]),
    ),
  };
}
