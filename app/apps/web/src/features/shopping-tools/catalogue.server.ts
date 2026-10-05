import "server-only";
import {
  getCategory,
  validateCategoryAttributeValue,
} from "@treido/contracts/categories";
import type {
  SellerDatabase,
  SellerTransaction,
} from "../../server/db/database";
import { publicListingCard } from "../catalog/public-discovery.server";
import type { DiscoveryAttribute } from "../catalog/discovery-input";
import { parseDraftPayload, validId } from "../selling/draft-model";
import { parsePublicationTerms } from "../selling/publish-model";
import { toCategoryAttributes } from "../selling/form-model";
import { parseOptions, whole, type StockState } from "../inventory/model";
import { SellerError } from "../sellers/errors";
import {
  buildToolQuery,
  buildComparisonFactsQuery,
} from "./catalogue-sql.server";
import { decodeToolCursor, encodeToolCursor } from "./cursor.server";
import { parseToolIntent, TOOL_LIMITS, type ToolMode } from "./intent";
import type { ToolListing, ToolResults } from "./model";
export type ToolRow = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerKind: "personal" | "business";
  revision: number;
  payload: unknown;
  terms: unknown;
  createdAt: Date;
  at: string;
  rank: number;
  checkedAt: Date;
  photoId: string;
  priceMinor: number;
  mode: "unique" | "stocked" | null;
  variants: number;
  available: number;
  stockState: StockState;
  variant: {
    id: string;
    options: unknown;
    priceMinor: number;
    available: number;
  } | null;
};
export function projectToolListing(row: ToolRow): ToolListing {
  const payload = parseDraftPayload(row.payload),
    terms = parsePublicationTerms(row.terms);
  const category = payload?.categoryId ? getCategory(payload.categoryId) : null;
  if (
    !payload ||
    !terms ||
    !payload.condition ||
    category?.kind !== "leaf" ||
    !whole(row.variants, 0, 100) ||
    !whole(row.available, 0, 100000000) ||
    !["unknown", "available", "reserved", "out_of_stock"].includes(
      row.stockState,
    )
  )
    throw new SellerError("NOT_AVAILABLE");
  const attributes: Record<string, DiscoveryAttribute> = {};
  for (const [key, value] of Object.entries(
    toCategoryAttributes(category, payload.fields),
  )) {
    const parsed = validateCategoryAttributeValue(category.id, key, value);
    if (parsed.ok)
      attributes[key] = parsed.attributes[key] as DiscoveryAttribute;
  }
  const v = row.variant;
  if (
    v &&
    (!validId(v.id) ||
      !whole(v.priceMinor, 0, 1000000000) ||
      !whole(v.available, 1, 1000000))
  )
    throw new SellerError("NOT_AVAILABLE");
  return {
    card: publicListingCard({
      id: row.id,
      sellerId: row.sellerId,
      sellerName: row.sellerName,
      sellerKind: row.sellerKind,
      revision: row.revision,
      title: payload.title,
      priceMinor: row.priceMinor,
      categoryId: category.id,
      condition: payload.condition,
      locality: payload.locality,
      createdAt: row.createdAt.toISOString(),
      rank: row.rank,
      photoId: row.photoId,
      stockState: row.stockState,
      priceFrom: row.variants > 1,
    }),
    revision: row.revision,
    attributes,
    defects: terms.defects || null,
    handover: terms.handover,
    deliveryDetails: terms.deliveryDetails || null,
    inventory: {
      state: row.stockState,
      mode: row.mode ?? "unknown",
      available: row.mode ? row.available : null,
      variants: row.variants,
    },
    variant: v ? { ...v, options: parseOptions(v.options) } : null,
    priceBasis: v
      ? "available_variant"
      : row.mode
        ? "no_available_variant"
        : "listing",
    shippingMinor: null,
    totalMinor: null,
    checkedAt: row.checkedAt.toISOString(),
  };
}
/** Public reads do not provision an identity or use a model/reference provider. */
export async function searchToolCatalogue(
  database: SellerDatabase,
  raw: unknown,
  mode: ToolMode,
): Promise<ToolResults> {
  const intent = parseToolIntent(raw, mode),
    position = decodeToolCursor(intent);
  const rows = (
    await database.pool.query<ToolRow>(buildToolQuery(intent, position))
  ).rows;
  const selected = rows.slice(0, TOOL_LIMITS.results),
    last = selected.at(-1);
  const items = selected.map(projectToolListing);
  if (
    items.some((item) =>
      Object.keys(intent.discovery.attributes).some(
        (key) => item.attributes[key] === undefined,
      ),
    )
  )
    throw new SellerError("NOT_AVAILABLE");
  return {
    intent,
    items,
    nextCursor:
      rows.length > TOOL_LIMITS.results && last
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
    checkedAt: rows[0]?.checkedAt.toISOString() ?? new Date().toISOString(),
  };
}
export async function readToolFacts(
  tx: Pick<SellerTransaction, "client">,
  ids: string[],
) {
  if (
    ids.length > TOOL_LIMITS.selections ||
    ids.some((id) => !validId(id)) ||
    new Set(ids).size !== ids.length
  )
    throw new SellerError("INVALID_INPUT");
  if (!ids.length) return new Map<string, ToolListing>();
  const rows = (await tx.client.query<ToolRow>(buildComparisonFactsQuery(ids)))
    .rows;
  return new Map(rows.map((row) => [row.id, projectToolListing(row)]));
}
