import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  publishedEligibility,
  publishedJoins,
} from "../catalog/publication-eligibility.server";
import {
  LIBRARY_LIMITS,
  parseLibraryCommand,
  type LibraryChange,
} from "./model";
import { libraryActorKey } from "./cursor.server";

async function saveListing(
  tx: SellerTransaction,
  userId: string,
  listingId: string,
  saved: boolean,
) {
  if (!saved) {
    await tx.client.query(
      "UPDATE treido.saved_listings SET saved=false WHERE user_id=$1 AND listing_id=$2",
      [userId, listingId],
    );
    await tx.client.query(
      "UPDATE treido.buyer_collection_items SET included=false WHERE user_id=$1 AND listing_id=$2",
      [userId, listingId],
    );
    return;
  }
  const eligible = await tx.client.query(
    "SELECT l.id " +
      publishedJoins +
      " WHERE l.id=$1 AND " +
      publishedEligibility +
      " FOR SHARE OF s,l",
    [listingId],
  );
  if (!eligible.rowCount) throw new SellerError("NOT_FOUND");
  const previous = (
    await tx.client.query<{ saved: boolean }>(
      "SELECT saved FROM treido.saved_listings WHERE user_id=$1 AND listing_id=$2",
      [userId, listingId],
    )
  ).rows[0];
  if (previous?.saved) return;
  const count = (
    await tx.client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM treido.saved_listings WHERE user_id=$1 AND saved",
      [userId],
    )
  ).rows[0].count;
  if (count >= LIBRARY_LIMITS.saved) throw new SellerError("QUOTA_EXCEEDED");
  await tx.client.query(
    "INSERT INTO treido.saved_listings(user_id,listing_id) VALUES($1,$2) ON CONFLICT(user_id,listing_id) DO UPDATE SET saved=true,saved_at=clock_timestamp()",
    [userId, listingId],
  );
}
/** Human lock serializes this person's revisions, limits, memberships and retry receipts. */
export async function changeLibrary(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<LibraryChange> {
  const input = parseLibraryCommand(raw);
  if (input.actorKey !== libraryActorKey(identity))
    throw new SellerError("UNAUTHENTICATED");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, true);
    await tx.client.query(
      "INSERT INTO treido.buyer_libraries(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [user.id],
    );
    const current = (
      await tx.client.query<{ revision: number }>(
        "SELECT revision FROM treido.buyer_libraries WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    const hash = inputHash(input);
    const receipt = (
      await tx.client.query<{
        hash: string;
        revision: number;
        resultId: string | null;
      }>(
        'SELECT input_hash AS hash,accepted_revision AS revision,result_id AS "resultId" FROM treido.buyer_library_receipts WHERE user_id=$1 AND request_id=$2',
        [user.id, input.requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.hash !== hash || receipt.revision !== current.revision)
        throw new SellerError("CONFLICT");
      return { revision: receipt.revision, resultId: receipt.resultId };
    }
    if (current.revision !== input.expectedRevision)
      throw new SellerError("CONFLICT");
    const rate = (
      await tx.client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM treido.buyer_library_receipts WHERE user_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [user.id],
      )
    ).rows[0].count;
    if (rate >= LIBRARY_LIMITS.commandsPerMinute)
      throw new SellerError("QUOTA_EXCEEDED");
    const operation = input.operation;
    let resultId: string | null = null;
    if (operation.kind === "save") {
      await saveListing(tx, user.id, operation.listingId, operation.saved);
    } else if (operation.kind === "follow") {
      if (operation.followed) {
        const eligible = await tx.client.query(
          "SELECT sa.id FROM treido.seller_accounts sa WHERE sa.id=$1 AND EXISTS(SELECT 1 " +
            publishedJoins +
            " WHERE s.id=sa.id AND " +
            publishedEligibility +
            ") FOR SHARE OF sa",
          [operation.sellerId],
        );
        if (!eligible.rowCount) throw new SellerError("NOT_FOUND");
        const previous = (
          await tx.client.query<{ followed: boolean }>(
            "SELECT followed FROM treido.seller_follows WHERE user_id=$1 AND seller_id=$2",
            [user.id, operation.sellerId],
          )
        ).rows[0];
        if (!previous?.followed) {
          const count = (
            await tx.client.query<{ count: number }>(
              "SELECT count(*)::int AS count FROM treido.seller_follows WHERE user_id=$1 AND followed",
              [user.id],
            )
          ).rows[0].count;
          if (count >= LIBRARY_LIMITS.follows)
            throw new SellerError("QUOTA_EXCEEDED");
          await tx.client.query(
            "INSERT INTO treido.seller_follows(user_id,seller_id) VALUES($1,$2) ON CONFLICT(user_id,seller_id) DO UPDATE SET followed=true,followed_at=clock_timestamp()",
            [user.id, operation.sellerId],
          );
        }
      } else
        await tx.client.query(
          "UPDATE treido.seller_follows SET followed=false WHERE user_id=$1 AND seller_id=$2",
          [user.id, operation.sellerId],
        );
    } else if (operation.kind === "createCollection") {
      const count = (
        await tx.client.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM treido.buyer_collections WHERE user_id=$1 AND active",
          [user.id],
        )
      ).rows[0].count;
      if (count >= LIBRARY_LIMITS.collections)
        throw new SellerError("QUOTA_EXCEEDED");
      resultId = randomUUID();
      await tx.client.query(
        "INSERT INTO treido.buyer_collections(user_id,id,name) VALUES($1,$2,$3)",
        [user.id, resultId, operation.name],
      );
      if (operation.listingId) {
        await saveListing(tx, user.id, operation.listingId, true);
        await tx.client.query(
          "INSERT INTO treido.buyer_collection_items(user_id,collection_id,listing_id) VALUES($1,$2,$3)",
          [user.id, resultId, operation.listingId],
        );
      }
    } else {
      const collection = await tx.client.query(
        "SELECT id FROM treido.buyer_collections WHERE user_id=$1 AND id=$2 AND active FOR UPDATE",
        [user.id, operation.collectionId],
      );
      if (!collection.rowCount) throw new SellerError("NOT_FOUND");
      if (operation.kind === "renameCollection")
        await tx.client.query(
          "UPDATE treido.buyer_collections SET name=$3 WHERE user_id=$1 AND id=$2",
          [user.id, operation.collectionId, operation.name],
        );
      else if (operation.kind === "deleteCollection") {
        await tx.client.query(
          "UPDATE treido.buyer_collections SET active=false WHERE user_id=$1 AND id=$2",
          [user.id, operation.collectionId],
        );
        await tx.client.query(
          "UPDATE treido.buyer_collection_items SET included=false WHERE user_id=$1 AND collection_id=$2",
          [user.id, operation.collectionId],
        );
      } else if (operation.kind === "collectionItem") {
        if (operation.included) {
          // Adding a published listing also saves it, in the same transaction.
          await saveListing(tx, user.id, operation.listingId, true);
          await tx.client.query(
            "INSERT INTO treido.buyer_collection_items(user_id,collection_id,listing_id) VALUES($1,$2,$3) ON CONFLICT(user_id,collection_id,listing_id) DO UPDATE SET included=true",
            [user.id, operation.collectionId, operation.listingId],
          );
        } else
          await tx.client.query(
            "UPDATE treido.buyer_collection_items SET included=false WHERE user_id=$1 AND collection_id=$2 AND listing_id=$3",
            [user.id, operation.collectionId, operation.listingId],
          );
      }
    }
    const revision = current.revision + 1;
    await tx.client.query(
      "UPDATE treido.buyer_libraries SET revision=$2 WHERE user_id=$1",
      [user.id, revision],
    );
    await tx.client.query(
      "INSERT INTO treido.buyer_library_receipts(user_id,request_id,input_hash,accepted_revision,result_id) VALUES($1,$2,$3,$4,$5)",
      [user.id, input.requestId, hash, revision, resultId],
    );
    return { revision, resultId };
  });
}
