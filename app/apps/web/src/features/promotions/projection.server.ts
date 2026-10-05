import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SellerDatabase } from "../../server/db/database";
import { readPublicDiscovery } from "../catalog/public-discovery.server";
import type { DiscoveryParams } from "../catalog/discovery-input";
import { publicInventoryJoin } from "../inventory/public-sql";
import {
  publishedEligibility,
  publishedJoins,
} from "../catalog/publication-eligibility.server";
import { promotionAvailability } from "./eligibility.server";
import { promotionPaymentBridge } from "./payment-bridge.server";
import { placeSponsored, type PromotionPlacement } from "./placement";
import type { PublicDiscoveryPage } from "../catalog/public-discovery-model";
import { UUID, HEX, type ProductId } from "./model";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  promotionPaidJoins,
  promotionPaidEligibility,
} from "./paid-eligibility.server";

type Token = {
  v: 1;
  campaignId: string;
  listingId: string;
  listingRevision: number;
  placementId: string;
  queryHash: string;
  expires: number;
};
function mac(key: Uint8Array, text: string) {
  return createHmac("sha256", key)
    .update("promotion-placement-visible-v1:" + text)
    .digest();
}
export function signPlacement(value: Token, key: Uint8Array) {
  const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
  return encoded + "." + mac(key, encoded).toString("base64url");
}
export function verifyPlacement(
  raw: unknown,
  key: Uint8Array,
  now: number,
): Token {
  if (typeof raw !== "string" || raw.length > 1024 || key.byteLength < 32)
    throw new SellerError("INVALID_INPUT");
  try {
    const [encoded, signature, ...rest] = raw.split("."),
      actual = Buffer.from(signature, "base64url");
    if (
      rest.length ||
      actual.length !== 32 ||
      !timingSafeEqual(actual, mac(key, encoded))
    )
      throw Error();
    const t = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Token;
    if (
      Object.keys(t).sort().join(",") !==
        "campaignId,expires,listingId,listingRevision,placementId,queryHash,v" ||
      t.v !== 1 ||
      !UUID(t.campaignId) ||
      !UUID(t.listingId) ||
      !UUID(t.placementId) ||
      !HEX(t.queryHash) ||
      !Number.isSafeInteger(t.listingRevision) ||
      t.listingRevision < 1 ||
      !Number.isSafeInteger(t.expires) ||
      t.expires <= now ||
      t.expires > now + 120000
    )
      throw Error();
    return t;
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
}

/** Real supply and all hard filters come from the existing canonical query, then paid eligibility is rechecked now. No serving with absent bridge. */
export async function readPromotionDiscovery(
  database: SellerDatabase,
  source: DiscoveryParams,
  options: {
    key: Uint8Array;
    requestId: string;
    surface: "home" | "search";
    sellerId?: string;
    excludeId?: string;
    limit?: number;
  },
): Promise<PublicDiscoveryPage & { placements: PromotionPlacement[] }> {
  if (!UUID(options.requestId) || options.key.byteLength < 32)
    throw new SellerError("INVALID_INPUT");
  const page = await readPublicDiscovery(database, source, options),
    bridge = promotionPaymentBridge();
  if (!bridge || page.items.length < 8)
    return { ...page, placements: placeSponsored(page.items, []) };
  const storage = (
    await database.pool.query<{ ready: boolean }>(
      `SELECT NOT EXISTS(SELECT 1 FROM unnest(ARRAY['promotion_campaigns','promotion_products','promotion_capacity','promotion_purchases','promotion_reviews','promotion_attempts','promotion_intervals','promotion_reservations','promotion_bump_signals','promotion_payment_bindings','promotion_customer_bindings','promotion_checkout_intents']) expected(name) WHERE to_regclass('treido.'||expected.name) IS NULL) AS ready`,
    )
  ).rows[0];
  if (!storage) throw new SellerError("NOT_AVAILABLE");
  if (!storage.ready)
    return { ...page, placements: placeSponsored(page.items, []) };
  const b = bridge.binding;
  const rows = (
    await database.pool.query<{
      campaignId: string;
      listingId: string;
      listingRevision: number;
      productId: ProductId;
      promotedFreshnessAt: Date | null;
      now: Date;
    }>(
      `SELECT pc.id AS "campaignId",l.id AS "listingId",p.revision AS "listingRevision",pc.product_id AS "productId",bs.promoted_at AS "promotedFreshnessAt",clock_timestamp() AS now ${publishedJoins} ${publicInventoryJoin} JOIN jsonb_to_recordset($9::jsonb) AS requested(id uuid,revision integer) ON requested.id=l.id AND requested.revision=p.revision ${promotionPaidJoins} WHERE l.id=ANY($1::uuid[]) AND ${promotionPaidEligibility} AND ${publishedEligibility} AND ${promotionAvailability} AND (pc.product_id='bump_once_v1' OR ($6='home' AND pc.product_id='home_spotlight_7d_v1') OR ($6='search' AND $7::text IS NOT NULL AND pc.product_id='category_spotlight_7d_v1')) ORDER BY md5(pc.id::text||coalesce(bs.promoted_at::text,'rotation')||$8),bs.promoted_at DESC NULLS LAST,pc.id LIMIT 24`,
      [
        page.items.map((item) => item.id),
        b.platformAccount,
        b.environment,
        b.applicationId,
        b.livemode,
        options.surface,
        page.input.category,
        options.requestId,
        JSON.stringify(
          page.items.map((item) => ({
            id: item.id,
            revision: Number(
              /[?]v=([0-9]+)$/.exec(item.images[0] ?? "")?.[1] ?? 0,
            ),
          })),
        ),
      ],
    )
  ).rows;
  const queryHash = inputHash({
    ...page.input,
    sellerId: options.sellerId ?? null,
  });
  const candidates = rows.map((row) => ({
    campaignId: row.campaignId,
    listingId: row.listingId,
    productId: row.productId,
    promotedFreshnessAt: row.promotedFreshnessAt?.toISOString() ?? null,
    token: signPlacement(
      {
        v: 1,
        campaignId: row.campaignId,
        listingId: row.listingId,
        listingRevision: row.listingRevision,
        placementId: options.requestId,
        queryHash,
        expires: row.now.getTime() + 120000,
      },
      options.key,
    ),
  }));
  return { ...page, placements: placeSponsored(page.items, candidates) };
}
