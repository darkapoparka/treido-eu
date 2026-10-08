import "server-only";
import { publicServiceSettings } from "../seller-settings/model";
import { createHmac } from "node:crypto";
import {
  browseCategoryRoots,
  getBrowseCategory,
  getBrowseChildren,
  getCategory,
  itemConditions,
} from "@treido/contracts/categories";
import type { SellerDatabase } from "../../server/db/database";
import {
  decodeDiscoveryCursor,
  encodeDiscoveryCursor,
  type DiscoveryPosition,
} from "../../server/discovery/cursor.server";
import { validId } from "../selling/draft-model";
import { readDiscoveryInput, type DiscoveryParams } from "./discovery-input";
import type {
  DiscoveryFacet,
  PublicDiscoveryPage,
  PublicListingCard,
  PublicSeller,
} from "./public-discovery-model";
import { buildPublicDiscoveryQuery } from "./public-discovery-sql";
import {
  publishedEligibility,
  publishedJoins,
} from "./publication-eligibility.server";

export function publicDiscoveryKey(): Uint8Array {
  const raw = process.env.TREIDO_DISCOVERY_CURSOR_KEY;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw))
    throw new Error("Public catalogue pagination is not configured.");
  return Buffer.from(raw, "hex");
}
export type CardRow = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerKind: "personal" | "business";
  revision: number;
  title: string;
  priceMinor: number;
  categoryId: string;
  condition: PublicListingCard["condition"];
  locality: string;
  createdAt: string;
  rank: number;
  photoId: string;
  priceFrom?: boolean;
  stockState?: PublicListingCard["stockState"];
};
export function publicListingCard(row: CardRow): PublicListingCard {
  if (
    !validId(row.id) ||
    !validId(row.sellerId) ||
    !validId(row.photoId) ||
    !Number.isSafeInteger(row.priceMinor) ||
    row.priceMinor < 0 ||
    row.priceMinor > 1_000_000_000 ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 2 ||
    !["personal", "business"].includes(row.sellerKind) ||
    !itemConditions.includes(row.condition) ||
    getCategory(row.categoryId)?.kind !== "leaf" ||
    typeof row.title !== "string" ||
    !row.title.trim() ||
    row.title.length > 160 ||
    typeof row.sellerName !== "string" ||
    typeof row.locality !== "string" ||
    row.locality.length > 100
  )
    throw new Error("Invalid public listing projection.");
  return {
    id: row.id,
    title: row.title,
    images: [
      "/api/listing-media/" + row.id + "/" + row.photoId + "?v=" + row.revision,
    ],
    price: { amount: row.priceMinor, currency: "EUR" },
    ratingCount: "",
    seller: { id: row.sellerId, name: row.sellerName, kind: row.sellerKind },
    categoryId: row.categoryId,
    condition: row.condition,
    locality: row.locality,
    publishedAt: new Date(row.createdAt).toISOString(),
    ...(row.priceFrom === true ? { priceFrom: true } : {}),
    ...(row.stockState &&
    ["unknown", "available", "reserved", "out_of_stock"].includes(
      row.stockState,
    )
      ? { stockState: row.stockState }
      : {}),
  };
}
export async function readPublicDiscovery(
  database: SellerDatabase,
  source: DiscoveryParams,
  options: {
    key: Uint8Array;
    sellerId?: string;
    excludeId?: string;
    limit?: number;
    previewCategories?: readonly string[];
  },
): Promise<PublicDiscoveryPage> {
  const { input, cursor } = readDiscoveryInput(source);
  if (
    (options.sellerId !== undefined && !validId(options.sellerId)) ||
    (options.excludeId !== undefined && !validId(options.excludeId))
  )
    throw new Error("Invalid public catalogue scope.");
  if (options.key.byteLength < 32 || options.key.byteLength > 128)
    throw new Error("Invalid catalogue cursor key.");
  const key = createHmac("sha256", options.key)
    .update(
      "public-catalogue-v2:inventory-price:" +
        (options.sellerId ?? "all") +
        ":" +
        (options.excludeId ?? "none"),
    )
    .digest();
  const position =
    cursor && !options.previewCategories
      ? decodeDiscoveryCursor(cursor, input, key)
      : null;
  const query = buildPublicDiscoveryQuery(input, { ...options, position });
  const row = (
    await database.pool.query<{
      total: number;
      items: CardRow[];
      categories: DiscoveryFacet[];
      conditions: DiscoveryFacet[];
      sellers: DiscoveryFacet[];
    }>(query.text, query.values)
  ).rows[0];
  if (!row || !Array.isArray(row.items))
    throw new Error("Public catalogue is unavailable.");
  const selected = row.items.slice(0, query.limit);
  const items = selected.map(publicListingCard);
  const last = selected.at(-1);
  let nextCursor: string | null = null;
  if (!options.previewCategories && row.items.length > query.limit && last) {
    const anchor: DiscoveryPosition = {
      id: last.id,
      createdAt: new Date(last.createdAt).toISOString(),
      ...(input.sort.startsWith("price_")
        ? { priceMinor: last.priceMinor }
        : input.sort === "relevance"
          ? { rank: last.rank }
          : {}),
    };
    nextCursor = encodeDiscoveryCursor(input, anchor, key);
  }
  return {
    input,
    items,
    total: row.total,
    facets: {
      categories: row.categories,
      conditions: row.conditions,
      sellers: row.sellers,
    },
    nextCursor,
    cursorReset: !options.previewCategories && !!cursor && !position,
  };
}

/** One eligible SQL snapshot samples each immediate browse branch, so the
 * newest department cannot crowd all other departments out of Explore. */
export function readPublicExplore(
  database: SellerDatabase,
  source: DiscoveryParams,
  options: { key: Uint8Array },
) {
  const { input } = readDiscoveryInput(source);
  const selected = input.category ? getBrowseCategory(input.category) : null;
  const branches = selected
    ? selected.kind === "leaf"
      ? [selected]
      : getBrowseChildren(selected.id)
    : browseCategoryRoots;
  return readPublicDiscovery(database, source, {
    ...options,
    previewCategories: branches.map((branch) => branch.id),
  });
}

/** A store becomes public only while it has currently eligible supply. */
export async function readPublicSeller(
  database: SellerDatabase,
  sellerId: string,
): Promise<PublicSeller | null> {
  if (!validId(sellerId)) return null;
  const row = (
    await database.pool.query<
      PublicSeller & { rawContact: unknown; rawDelivery: unknown }
    >(
      "SELECT sa.id,sa.name,sa.kind,coalesce(profile.description,'') AS description,coalesce(profile.locality,'') AS locality,'BG' AS country, " +
        "(SELECT payload FROM treido.seller_service_settings WHERE seller_id=sa.id AND section='contact' AND payload->'published'='true'::jsonb) AS \"rawContact\", " +
        "(SELECT payload FROM treido.seller_service_settings WHERE seller_id=sa.id AND section='delivery' AND payload->'published'='true'::jsonb) AS \"rawDelivery\" " +
        "FROM treido.seller_accounts sa LEFT JOIN treido.seller_profiles profile ON profile.seller_id=sa.id " +
        "WHERE sa.id=$1 AND EXISTS(SELECT 1 " +
        publishedJoins +
        " WHERE s.id=sa.id AND " +
        publishedEligibility +
        ") LIMIT 1",
      [sellerId],
    )
  ).rows[0];
  if (!row) return null;
  const { rawContact, rawDelivery, ...seller } = row;
  const services = publicServiceSettings(rawContact, rawDelivery);
  return services.contact || services.delivery
    ? { ...seller, services }
    : seller;
}
