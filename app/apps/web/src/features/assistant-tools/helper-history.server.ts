import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { requireAssistantStorage } from "./storage.server";
import { HELPER_HISTORY_PAGE_SIZE, parseHelperHistoryQuery, type HelperHistoryView } from "./helper-history-model";
import type { HelperChange } from "./sell-helper-model";

/** Minimal durable decision receipts, not reconstructed old proposal text.
 * History belongs to this human within this currently authorized seller. */
export async function readHelperHistory(database: SellerDatabase, identity: VerifiedIdentity, raw: unknown): Promise<HelperHistoryView> {
  const { sellerId, before } = parseHelperHistoryQuery(raw);
  return inTransaction(database, async (tx) => {
    await tx.client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await tx.client.query("SET LOCAL statement_timeout = '2500ms'");
    await tx.client.query("SET LOCAL lock_timeout = '1500ms'");
    const { user } = await authorizeSeller(tx, identity, sellerId, "listing.write");
    await requireAssistantStorage(tx);
    if (before) {
      const anchor = await tx.client.query("SELECT request_id FROM treido.seller_helper_receipts WHERE user_id=$1 AND seller_id=$2 AND request_id=$3", [user.id, sellerId, before]);
      if (anchor.rowCount !== 1) throw new SellerError("NOT_FOUND");
    }
    const rows = (await tx.client.query<{ requestId: string; operation: "prepare" | "accept" | "discard"; revision: number; result: HelperChange; createdAt: Date }>(
      `SELECT request_id AS "requestId",operation,accepted_revision AS revision,result,created_at AS "createdAt"
       FROM treido.seller_helper_receipts WHERE user_id=$1 AND seller_id=$2
       AND ($3::uuid IS NULL OR (created_at,request_id)<(SELECT created_at,request_id FROM treido.seller_helper_receipts WHERE user_id=$1 AND seller_id=$2 AND request_id=$3))
       ORDER BY created_at DESC,request_id DESC LIMIT $4`,
      [user.id, sellerId, before, HELPER_HISTORY_PAGE_SIZE + 1],
    )).rows;
    const selected = rows.slice(0, HELPER_HISTORY_PAGE_SIZE);
    return {
      sellerId, nextBefore: rows.length > HELPER_HISTORY_PAGE_SIZE ? selected.at(-1)!.requestId : null,
      items: selected.map((row) => {
        if (!row.result || !["prepared", "discarded", "applied", "conflict"].includes(row.result.outcome) || row.result.revision !== row.revision ||
          (row.result.draftId !== null && !validId(row.result.draftId)) ||
          (row.result.draftRevision !== null && (!Number.isSafeInteger(row.result.draftRevision) || row.result.draftRevision < 1))) throw new SellerError("NOT_AVAILABLE");
        return { requestId: row.requestId, operation: row.operation, outcome: row.result.outcome, draftId: row.result.draftId,
          draftRevision: row.result.draftRevision, revision: row.revision, createdAt: row.createdAt.toISOString() };
      }),
    };
  });
}
