import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "./persistence.server";
import { SellerError } from "./errors";
import { validId } from "../selling/draft-model";
import {
  parseProductQuery,
  type AdminProduct,
  type AdminProducts,
} from "./admin-products-model";

// A cursor supplies a position, never authority. Bind it to this seller/filter/sort.
function cursorPosition(cursor: string | null, scope: string) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      value.scope !== scope ||
      !validId(value.id) ||
      typeof value.at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value.at) ||
      !Number.isFinite(Date.parse(value.at)) ||
      Number(value.at.slice(0, 4)) < 1 ||
      new Date(value.at).toISOString().slice(0, 19) !== value.at.slice(0, 19)
    )
      throw new Error();
    return { id: value.id as string, at: value.at as string };
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
}

export async function readAdminProducts(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  input: Record<string, unknown> = {},
): Promise<AdminProducts> {
  const query = parseProductQuery(input);
  if (!query) throw new SellerError("INVALID_INPUT");
  const scope = JSON.stringify([sellerId, query.q, query.status, query.sort]);
  const position = cursorPosition(query.cursor, scope);
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    const counts = await tx.client.query<{
      status: AdminProduct["status"];
      count: number;
    }>(
      `SELECT CASE WHEN moderation_state <> 'clear' THEN 'restricted' ELSE publication END AS status, count(*)::int AS count FROM treido.listings WHERE seller_id=$1 GROUP BY 1`,
      [sellerId],
    );
    const direction = query.sort === "oldest" ? "ASC" : "DESC";
    const operator = query.sort === "oldest" ? ">" : "<";
    const rows = await tx.client.query<AdminProduct>(
      `
      SELECT l.id, coalesce(d.payload->>'title','') AS title,
        (d.payload->>'priceMinor')::int AS "priceMinor", 'EUR' AS currency,
        CASE WHEN l.moderation_state <> 'clear' THEN 'restricted' ELSE l.publication END AS status,
        d.revision, to_char(d.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt",
        (SELECT m.id FROM treido.media_assets m WHERE m.seller_id=l.seller_id AND m.listing_id=l.id AND m.state='ready' ORDER BY m.position, m.id LIMIT 1) AS "mediaId"
      FROM treido.listing_drafts d JOIN treido.listings l ON l.seller_id=d.seller_id AND l.id=d.listing_id
      WHERE d.seller_id=$1 AND ($2='' OR position(lower($2) in lower(coalesce(d.payload->>'title',''))) > 0)
        AND ($3='all' OR CASE WHEN l.moderation_state <> 'clear' THEN 'restricted' ELSE l.publication END=$3)
        AND ($4::timestamptz IS NULL OR (d.updated_at,d.listing_id) ${operator} ($4::timestamptz,$5::uuid))
      ORDER BY d.updated_at ${direction}, d.listing_id ${direction} LIMIT 31`,
      [
        sellerId,
        query.q,
        query.status,
        position?.at ?? null,
        position?.id ?? null,
      ],
    );
    const items = rows.rows.slice(0, 30);
    const last = items.at(-1);
    return {
      items,
      query,
      counts: counts.rows.reduce(
        (result, row) => ({
          ...result,
          all: result.all + row.count,
          [row.status]: row.count,
        }),
        { all: 0, draft: 0, published: 0, withdrawn: 0, restricted: 0 },
      ),
      nextCursor:
        rows.rows.length > 30 && last
          ? Buffer.from(
              JSON.stringify({ scope, at: last.updatedAt, id: last.id }),
            ).toString("base64url")
          : null,
    };
  });
}
