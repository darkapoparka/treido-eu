import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { buildToolQuery } from "../shopping-tools/catalogue-sql.server";
import {
  projectToolListing,
  type ToolRow,
} from "../shopping-tools/catalogue.server";
import { parseToolIntent } from "../shopping-tools/intent";
import type { ToolResults } from "../shopping-tools/model";
export async function inputCatalogue(
  tx: SellerTransaction,
  userId: string,
  canonical: string,
): Promise<ToolResults> {
  const intent = parseToolIntent(canonical, "find-for-me");
  intent.availability = "known";
  const rows = (
    await tx.client.query<ToolRow>(buildToolQuery(intent, null))
  ).rows.slice(0, 20);
  const blocked = (
    await tx.client.query<{ sellerId: string }>(
      `SELECT seller_id AS "sellerId" FROM treido.contact_preferences WHERE buyer_id=$1 AND seller_id=ANY($2::uuid[]) AND (buyer_blocked OR seller_blocked)`,
      [userId, [...new Set(rows.map((row) => row.sellerId))]],
    )
  ).rows;
  const denied = new Set(blocked.map((row) => row.sellerId));
  const items = rows
    .filter((row) => !denied.has(row.sellerId))
    .map(projectToolListing)
    .filter(
      (item) =>
        item.inventory.state === "available" &&
        item.priceBasis === "available_variant",
    );
  return {
    intent,
    items,
    nextCursor: null,
    checkedAt: new Date().toISOString(),
  };
}
