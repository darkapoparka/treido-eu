import "server-only";
import {
  publicInventoryJoin,
  publicInventoryPrice,
} from "../inventory/public-sql";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  publicListingCard,
  type CardRow,
} from "../catalog/public-discovery.server";
import {
  publishedEligibility,
  publishedJoins,
} from "../catalog/publication-eligibility.server";
import type { PublicSeller } from "../catalog/public-discovery-model";
import {
  LIBRARY_LIMITS,
  parseLibraryQuery,
  type LibraryView,
  type LibraryCollection,
} from "./model";
import {
  libraryActorKey,
  encodeLibraryCursor,
  decodeLibraryCursor,
} from "./cursor.server";

const photo =
  "(SELECT pm.asset_id FROM treido.listing_publication_media pm WHERE pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision ORDER BY pm.position LIMIT 1)";
const photoUrl =
  "'/api/listing-media/' || l.id || '/' || " +
  photo +
  " || '?v=' || p.revision";
const cardProjection =
  "SELECT jsonb_build_object('id',l.id,'sellerId',s.id,'sellerName',s.name,'sellerKind',s.kind,'revision',p.revision,'title',p.payload->>'title','priceMinor'," +
  publicInventoryPrice +
  ",'priceFrom',stock.price_from,'stockState',stock.state,'categoryId',p.category_id,'condition',p.payload->>'condition','locality',p.payload->>'locality','createdAt',p.created_at,'rank',0,'photoId'," +
  photo +
  ") AS card " +
  publishedJoins +
  " " +
  publicInventoryJoin;
const timestamp = '\'YYYY-MM-DD"T"HH24:MI:SS.US"Z"\'';
const inCollection =
  "($2::uuid IS NULL OR EXISTS(SELECT 1 FROM treido.buyer_collection_items ci WHERE ci.user_id=b.user_id AND ci.listing_id=b.listing_id AND ci.collection_id=$2 AND ci.included))";

/** Reads never create an account, seller, collection or save. No reference catalogue is consulted. */
export async function readLibrary(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<LibraryView> {
  const input = parseLibraryQuery(raw),
    actorKey = libraryActorKey(identity);
  const position = decodeLibraryCursor(input.cursor, actorKey, input);
  return inTransaction(database, async (tx) => {
    const result: LibraryView = {
      actorKey,
      revision: 0,
      savedIds: [],
      followedIds: [],
      collections: [],
      items: [],
      follows: [],
      savedCount: 0,
      followingCount: 0,
      total: 0,
      nextCursor: null,
    };
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (!(error instanceof SellerError) || error.code !== "NOT_FOUND")
        throw error;
      if (input.collectionId) throw new SellerError("NOT_FOUND");
      return result;
    }
    result.revision =
      (
        await tx.client.query<{ revision: number }>(
          "SELECT revision FROM treido.buyer_libraries WHERE user_id=$1",
          [user.id],
        )
      ).rows[0]?.revision ?? 0;
    const counts = (
      await tx.client.query<{ saved: number; followed: number }>(
        "SELECT (SELECT count(*)::int FROM treido.saved_listings WHERE user_id=$1 AND saved) AS saved,(SELECT count(*)::int FROM treido.seller_follows WHERE user_id=$1 AND followed) AS followed",
        [user.id],
      )
    ).rows[0];
    result.savedCount = counts.saved;
    result.followingCount = counts.followed;
    result.collections = (
      await tx.client.query<LibraryCollection>(
        "SELECT bc.id,bc.name,(SELECT count(*)::int FROM treido.buyer_collection_items ci JOIN treido.saved_listings sl ON sl.user_id=ci.user_id AND sl.listing_id=ci.listing_id AND sl.saved WHERE ci.user_id=bc.user_id AND ci.collection_id=bc.id AND ci.included) AS count," +
          "EXISTS(SELECT 1 FROM treido.buyer_collection_items ci WHERE ci.user_id=bc.user_id AND ci.collection_id=bc.id AND ci.listing_id=$2 AND ci.included) AS contains," +
          "coalesce((SELECT jsonb_agg(cover.url) FROM (SELECT " +
          photoUrl +
          " AS url " +
          publishedJoins +
          " JOIN treido.buyer_collection_items ci ON ci.listing_id=l.id AND ci.user_id=bc.user_id AND ci.collection_id=bc.id AND ci.included JOIN treido.saved_listings sl ON sl.user_id=ci.user_id AND sl.listing_id=ci.listing_id AND sl.saved WHERE " +
          publishedEligibility +
          " ORDER BY sl.saved_at DESC,l.id DESC LIMIT 4) cover),'[]'::jsonb) AS covers " +
          "FROM treido.buyer_collections bc WHERE bc.user_id=$1 AND bc.active ORDER BY bc.created_at DESC,bc.id DESC LIMIT $3",
        [user.id, input.pickerId, LIBRARY_LIMITS.collections],
      )
    ).rows;
    if (
      input.collectionId &&
      !result.collections.some((row) => row.id === input.collectionId)
    )
      throw new SellerError("NOT_FOUND");
    if (input.view === "saved") {
      result.total = input.collectionId
        ? result.collections.find((row) => row.id === input.collectionId)!.count
        : result.savedCount;
      const rows = (
        await tx.client.query<{
          id: string;
          at: string;
          card: CardRow | null;
          collectionIds: string[];
        }>(
          "SELECT b.listing_id AS id,to_char(b.saved_at AT TIME ZONE 'UTC'," +
            timestamp +
            ') AS at,public.card,ARRAY(SELECT ci.collection_id::text FROM treido.buyer_collection_items ci JOIN treido.buyer_collections bc ON bc.user_id=ci.user_id AND bc.id=ci.collection_id AND bc.active WHERE ci.user_id=b.user_id AND ci.listing_id=b.listing_id AND ci.included ORDER BY ci.collection_id) AS "collectionIds" FROM treido.saved_listings b LEFT JOIN LATERAL (' +
            cardProjection +
            " WHERE l.id=b.listing_id AND " +
            publishedEligibility +
            ") public ON true WHERE b.user_id=$1 AND b.saved AND " +
            inCollection +
            " AND ($3::timestamptz IS NULL OR (b.saved_at,b.listing_id)<($3::timestamptz,$4::uuid)) ORDER BY b.saved_at DESC,b.listing_id DESC LIMIT $5",
          [
            user.id,
            input.collectionId,
            position?.at ?? null,
            position?.id ?? null,
            LIBRARY_LIMITS.page + 1,
          ],
        )
      ).rows;
      const selected = rows.slice(0, LIBRARY_LIMITS.page);
      // Ineligible rows disclose only their already-owned bookmark ID, never draft text or old photos.
      result.items = selected.map((row) => ({
        id: row.id,
        card: row.card ? publicListingCard(row.card) : null,
        collectionIds: row.collectionIds,
      }));
      const last = selected.at(-1);
      if (rows.length > LIBRARY_LIMITS.page && last)
        result.nextCursor = encodeLibraryCursor(
          { id: last.id, at: last.at },
          actorKey,
          input,
        );
    } else if (input.view === "following") {
      result.total = result.followingCount;
      const rows = (
        await tx.client.query<{
          id: string;
          at: string;
          seller: PublicSeller | null;
        }>(
          "SELECT b.seller_id AS id,to_char(b.followed_at AT TIME ZONE 'UTC'," +
            timestamp +
            ") AS at,public.seller FROM treido.seller_follows b LEFT JOIN LATERAL (SELECT jsonb_build_object('id',sa.id,'name',sa.name,'kind',sa.kind,'description',coalesce(profile.description,''),'locality',coalesce(profile.locality,''),'country','BG') AS seller FROM treido.seller_accounts sa LEFT JOIN treido.seller_profiles profile ON profile.seller_id=sa.id WHERE sa.id=b.seller_id AND EXISTS(SELECT 1 " +
            publishedJoins +
            " WHERE s.id=sa.id AND " +
            publishedEligibility +
            ")) public ON true WHERE b.user_id=$1 AND b.followed AND ($2::timestamptz IS NULL OR (b.followed_at,b.seller_id)<($2::timestamptz,$3::uuid)) ORDER BY b.followed_at DESC,b.seller_id DESC LIMIT $4",
          [
            user.id,
            position?.at ?? null,
            position?.id ?? null,
            LIBRARY_LIMITS.page + 1,
          ],
        )
      ).rows;
      const selected = rows.slice(0, LIBRARY_LIMITS.page);
      result.follows = selected.map(({ id, seller }) => ({ id, seller }));
      const last = selected.at(-1);
      if (rows.length > LIBRARY_LIMITS.page && last)
        result.nextCursor = encodeLibraryCursor(
          { id: last.id, at: last.at },
          actorKey,
          input,
        );
    }
    const listingIds = [
      ...new Set([
        ...input.listingIds,
        ...result.items.map((row) => row.id),
        ...(input.pickerId ? [input.pickerId] : []),
      ]),
    ];
    const sellerIds = [
      ...new Set([
        ...input.sellerIds,
        ...result.follows.map((row) => row.id),
        ...result.items.flatMap((row) =>
          row.card ? [row.card.seller.id] : [],
        ),
      ]),
    ];
    result.savedIds = (
      await tx.client.query<{ id: string }>(
        "SELECT listing_id AS id FROM treido.saved_listings WHERE user_id=$1 AND saved AND listing_id=ANY($2::uuid[])",
        [user.id, listingIds],
      )
    ).rows.map((row) => row.id);
    result.followedIds = (
      await tx.client.query<{ id: string }>(
        "SELECT seller_id AS id FROM treido.seller_follows WHERE user_id=$1 AND followed AND seller_id=ANY($2::uuid[])",
        [user.id, sellerIds],
      )
    ).rows.map((row) => row.id);
    return result;
  });
}
