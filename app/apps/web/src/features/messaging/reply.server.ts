import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { authorizeConversation } from "./conversation-access.server";
import { sendConversationMessage } from "./participants.server";
import { parseReplyCommand, type ReplyReceipt } from "./reply-model";
export async function sendRecoverableReply(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<ReplyReceipt> {
  const command = parseReplyCommand(raw);
  if (command.actorSubject !== identity.subject)
    throw new SellerError("FORBIDDEN");
  const scope = { sellerId: command.sellerId };
  const previous = await inTransaction(database, async (tx) => {
    // Acknowledging the caller's already-sent message requires current READ
    // authority, not permission to send again after a block or withdrawal.
    // New sends still go through the unchanged, stricter message transaction.
    const { user } = await authorizeConversation(
      tx,
      identity,
      command.threadId,
      false,
      scope,
    );
    const row = (
      await tx.client.query<{ id: string; sequence: number; hash: string }>(
        "SELECT id,sequence,input_hash AS hash FROM treido.messages WHERE thread_id=$1 AND author_id=$2 AND request_id=$3 AND offer_event_id IS NULL",
        [command.threadId, user.id, command.requestId],
      )
    ).rows[0];
    if (
      row &&
      row.hash !== inputHash({ body: command.body, attachmentIds: [] })
    )
      throw new SellerError("CONFLICT");
    return row ? { id: row.id, sequence: row.sequence } : null;
  });
  if (previous) return { ...previous, recovered: true };
  const receipt = await sendConversationMessage(
    database,
    identity,
    {
      threadId: command.threadId,
      requestId: command.requestId,
      body: command.body,
      attachmentIds: [],
    },
    scope,
  );
  return { ...receipt, recovered: false };
}
