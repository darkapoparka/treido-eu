import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { markConversationReadInTransaction } from "../messaging/inbox.server";
import { parseNotificationRead, type NotificationReadResult } from "./model";

export async function markNotificationsRead(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<NotificationReadResult[]> {
  const command = parseNotificationRead(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  const results: NotificationReadResult[] = [],
    started = Date.now();
  for (const row of command.rows) {
    if (Date.now() - started >= 8000) {
      results.push({ ...row, state: "unresolved", code: "DEFERRED" });
      continue;
    }
    try {
      const acknowledgedThrough = await inTransaction(database, async (tx) => {
        // Current participant/seller authority and thread locks are acquired by
        // the same primitive used by the inbox. Any tuple mismatch below rolls
        // back this cursor write together with the rest of this row transaction.
        const receipt = await markConversationReadInTransaction(tx, identity, {
          sellerId: command.sellerId,
          threadId: row.threadId,
          sequence: row.sequence,
        });
        const target = await tx.client.query(
          `SELECT m.id FROM treido.messages m JOIN treido.message_notification_intents n ON n.thread_id=m.thread_id AND n.message_id=m.id
           JOIN treido.conversation_threads c ON c.id=m.thread_id
           WHERE m.id=$1 AND m.thread_id=$2 AND m.sequence=$3
           AND CASE WHEN $4::uuid IS NULL THEN n.recipient_side='buyer' AND m.author_id<>c.buyer_id
           AND NOT EXISTS(SELECT 1 FROM treido.personal_seller_owners own WHERE own.seller_id=c.seller_id AND own.user_id=c.buyer_id)
           AND NOT EXISTS(SELECT 1 FROM treido.seller_memberships sm WHERE sm.seller_id=c.seller_id AND sm.user_id=c.buyer_id AND sm.status='active')
           ELSE c.seller_id=$4 AND n.recipient_side='seller' AND m.author_id=c.buyer_id END`,
          [row.messageId, row.threadId, row.sequence, command.sellerId],
        );
        if (target.rowCount !== 1) throw new SellerError("INVALID_INPUT");
        return receipt.sequence;
      });
      results.push({ ...row, state: "read", acknowledgedThrough });
    } catch (error) {
      const code = error instanceof SellerError ? error.code : "NOT_AVAILABLE";
      if (!(error instanceof SellerError))
        console.error("Treido notification read acknowledgment unavailable.");
      results.push({
        ...row,
        state:
          code === "INVALID_INPUT" || code === "CONFLICT"
            ? "rejected"
            : "unresolved",
        code,
      });
    }
  }
  // Each row is independent. A lost response can safely replay the same tuple:
  // greatest(existing, selectedSequence) cannot mark a later message as read.
  return results;
}
