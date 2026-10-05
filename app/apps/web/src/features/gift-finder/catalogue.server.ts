import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { buildToolQuery } from "../shopping-tools/catalogue-sql.server";
import {
  projectToolListing,
  type ToolRow,
} from "../shopping-tools/catalogue.server";
import {
  decodeToolCursor,
  encodeToolCursor,
} from "../shopping-tools/cursor.server";
import type { ToolListing } from "../shopping-tools/model";
import { SellerError } from "../sellers/errors";
import {
  GIFT_LIMITS,
  giftIntent,
  unsupportedGiftFields,
  type GiftBrief,
} from "./model";

/** Fixed existing strict catalogue SQL and signed pagination, on the same
 * transaction connection. No separate pool, provider or unbounded scan. */
export async function giftCatalogue(
  tx: SellerTransaction,
  userId: string,
  brief: GiftBrief,
  cursor: string | null = null,
  ids?: string[],
) {
  if (unsupportedGiftFields(brief).length)
    return { items: [] as ToolListing[], nextCursor: null as string | null };
  const intent = giftIntent(brief, cursor),
    position = decodeToolCursor(intent);
  const rows = (
    await tx.client.query<ToolRow>(
      buildToolQuery(intent, position, ids ? { ids } : undefined),
    )
  ).rows;
  const page = rows.slice(0, GIFT_LIMITS.candidates),
    last = page.at(-1);
  const blocked = (
    await tx.client.query<{ sellerId: string }>(
      'SELECT seller_id AS "sellerId" FROM treido.contact_preferences WHERE buyer_id=$1 AND seller_id=ANY($2::uuid[]) AND (buyer_blocked OR seller_blocked)',
      [userId, [...new Set(page.map((row) => row.sellerId))]],
    )
  ).rows;
  const denied = new Set(blocked.map((row) => row.sellerId));
  const items = page
    .filter((row) => !denied.has(row.sellerId))
    .map(projectToolListing);
  if (
    items.some((item) =>
      Object.keys(intent.discovery.attributes).some(
        (key) => item.attributes[key] === undefined,
      ),
    )
  )
    throw new SellerError("NOT_AVAILABLE");
  return {
    items,
    nextCursor:
      !ids && rows.length > GIFT_LIMITS.candidates && last
        ? encodeToolCursor(
            {
              id: last.id,
              at: last.at,
              price: last.priceMinor,
              rank: last.rank,
            },
            intent,
          )
        : null,
  };
}
