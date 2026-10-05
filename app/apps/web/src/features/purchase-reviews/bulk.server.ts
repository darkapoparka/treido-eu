import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { cancelReservedOfferInTransaction } from "../offers/offers.server";
import { parseCancellationBatch, type CancellationResult } from "./bulk-model";

/** Independent row transactions retain partial success. A commit whose reply is
 * lost remains unresolved; replay checks the original durable row receipt before
 * touching the offer or inventory. Never infer cancellation from a queue refresh. */
export async function cancelReservationBatch(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<CancellationResult[]> {
  const batch = parseCancellationBatch(raw);
  if (batch.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  const results: CancellationResult[] = [];
  const deadline = Date.now() + 8000;
  for (const row of batch.rows) {
    const reference = {
      allocationId: row.allocationId,
      requestId: row.requestId,
    };
    // This limits work between transactions, not authority or reservation time.
    // Untouched rows keep their original identities for an explicit continuation.
    if (Date.now() >= deadline) {
      results.push({ ...reference, state: "unresolved", code: "BATCH_PAUSED" });
      continue;
    }
    try {
      const receipt = await inTransaction(database, (tx) =>
        cancelReservedOfferInTransaction(tx, identity, {
          ...row,
          actorKey: batch.actorKey,
          sellerId: batch.sellerId,
        }),
      );
      results.push({ ...reference, state: "cancelled", receipt });
    } catch (error) {
      // Lost access cannot establish whether an earlier unacknowledged attempt
      // committed. Only definite domain rejection is safe to retire as rejected.
      const rejected =
        error instanceof SellerError &&
        ["INVALID_INPUT", "CONFLICT", "QUOTA_EXCEEDED"].includes(error.code);
      if (!(error instanceof SellerError))
        console.error("Treido reservation row outcome unavailable.");
      results.push({
        ...reference,
        state: rejected ? "rejected" : "unresolved",
        code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
      });
    }
  }
  return results;
}
