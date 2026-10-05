import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { authorizeConversation } from "../messaging/conversation-access.server";
import { sendConversationMessageInTransaction } from "../messaging/participants.server";
import { readSentInquiryInTransaction } from "./queries.server";
import {
  parseInquiryCommand,
  type InquiryResult,
  type InquiryStatus,
} from "./model";
export async function changeInquiry(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<InquiryResult> {
  const command = parseInquiryCommand(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, command.sellerId, "inbox.reply");
    const item = await readSentInquiryInTransaction(
      tx,
      command.sellerId,
      command.reviewId,
    );
    const access = await authorizeConversation(
      tx,
      identity,
      item.threadId,
      "contact",
      { sellerId: command.sellerId },
    );
    if (!access.canBlock) throw new SellerError("FORBIDDEN");
    // Contact then thread then workflow row. All inquiry writes use this order,
    // matching ordinary message sends and preserving current block authority.
    await tx.client.query(
      "SELECT id FROM treido.conversation_threads WHERE id=$1 FOR UPDATE",
      [item.threadId],
    );
    await tx.client.query(
      "INSERT INTO treido.merchant_inquiry_state(review_id,seller_id,thread_id,message_id,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(review_id) DO NOTHING",
      [item.id, item.sellerId, item.threadId, item.messageId, access.user.id],
    );
    const state = (
      await tx.client.query<{ revision: number; status: InquiryStatus }>(
        "SELECT revision,status FROM treido.merchant_inquiry_state WHERE review_id=$1 AND seller_id=$2 FOR UPDATE",
        [item.id, item.sellerId],
      )
    ).rows[0];
    if (!state) throw new SellerError("NOT_FOUND");
    const hash = inputHash(command);
    const prior = (
      await tx.client.query<{
        hash: string;
        revision: number;
        messageId: string | null;
      }>(
        `SELECT input_hash AS hash,accepted_revision AS revision,reply_message_id AS "messageId" FROM treido.merchant_inquiry_receipts WHERE review_id=$1 AND actor_id=$2 AND request_id=$3`,
        [item.id, access.user.id, command.requestId],
      )
    ).rows[0];
    // A historical acknowledgment may be returned after subsequent edits, but it
    // never reapplies the status/message or claims that the old revision is current.
    if (prior) {
      if (prior.hash !== hash) throw new SellerError("CONFLICT");
      return {
        ...state,
        acceptedRevision: prior.revision,
        messageId: prior.messageId,
      };
    }
    if (state.revision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    if (command.operation.kind === "reply" && !access.canReply)
      throw new SellerError("NOT_AVAILABLE");
    const nextStatus =
      command.operation.kind === "reply"
        ? "waiting_buyer"
        : command.operation.status;
    if (command.operation.kind === "status" && nextStatus === state.status)
      throw new SellerError("CONFLICT");
    const recent = (
      await tx.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM treido.merchant_inquiry_receipts WHERE review_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [item.id],
      )
    ).rows[0].n;
    if (recent >= 30) throw new SellerError("QUOTA_EXCEEDED");
    let messageId: string | null = null;
    if (command.operation.kind === "reply") {
      const message = await sendConversationMessageInTransaction(
        tx,
        identity,
        {
          threadId: item.threadId,
          requestId: command.requestId,
          body: command.operation.body,
          attachmentIds: [],
        },
        { sellerId: item.sellerId },
      );
      messageId = message.id;
    }
    const revision = state.revision + 1;
    await tx.client.query(
      "UPDATE treido.merchant_inquiry_state SET status=$3,revision=$4,updated_by=$5,updated_at=clock_timestamp() WHERE review_id=$1 AND seller_id=$2",
      [item.id, item.sellerId, nextStatus, revision, access.user.id],
    );
    await tx.client.query(
      "INSERT INTO treido.merchant_inquiry_receipts(review_id,seller_id,actor_id,request_id,input_hash,kind,from_status,to_status,accepted_revision,reply_message_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        item.id,
        item.sellerId,
        access.user.id,
        command.requestId,
        hash,
        command.operation.kind,
        state.status,
        nextStatus,
        revision,
        messageId,
      ],
    );
    return {
      revision,
      status: nextStatus,
      acceptedRevision: revision,
      messageId,
    };
  });
}
