import {
  caseStorageReady,
  messageHiddenSql,
} from "../trust/case-storage.server";
import "server-only";
import { imageTombstoned } from "../message-attachments/lifecycle-access.server";
import {
  publishedJoins,
  publishedEligibility,
} from "../catalog/publication-eligibility.server";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { parseMessageInput } from "./message-model";

import {
  authorizeConversation,
  threadColumns as columns,
  type Thread,
} from "./conversation-access.server";
export { authorizeConversation } from "./conversation-access.server";
import { parseInboxScope, type InboxScope } from "./inbox-model";

export async function openListingConversation(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  listingId: string,
) {
  if (!validId(listingId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, true);
    const owner = (
      await tx.client.query<{ sellerId: string }>(
        'SELECT seller_id AS "sellerId" FROM treido.listings WHERE id=$1',
        [listingId],
      )
    ).rows[0];
    if (!owner) throw new SellerError("NOT_FOUND");
    const seller = (
      await tx.client.query<{ status: string }>(
        "SELECT status FROM treido.seller_accounts WHERE id=$1 FOR SHARE",
        [owner.sellerId],
      )
    ).rows[0];
    await tx.client.query(
      "INSERT INTO treido.contact_preferences(seller_id,buyer_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [owner.sellerId, user.id],
    );
    const contact = (
      await tx.client.query<{ blocked: boolean }>(
        "SELECT (buyer_blocked OR seller_blocked) AS blocked FROM treido.contact_preferences WHERE seller_id=$1 AND buyer_id=$2 FOR UPDATE",
        [owner.sellerId, user.id],
      )
    ).rows[0];
    if (contact.blocked) throw new SellerError("FORBIDDEN");
    const listing = (
      await tx.client.query<{ publication: string; moderation: string }>(
        "SELECT publication,moderation_state AS moderation FROM treido.listings WHERE id=$1 FOR SHARE",
        [listingId],
      )
    ).rows[0];
    if (
      seller?.status !== "active" ||
      listing?.publication !== "published" ||
      listing.moderation !== "clear"
    )
      throw new SellerError("NOT_FOUND");
    const policy = await tx.client.query(
      "SELECT l.id " +
        publishedJoins +
        " WHERE l.id=$1 AND " +
        publishedEligibility,
      [listingId],
    );
    if (policy.rowCount !== 1) throw new SellerError("NOT_FOUND");
    const self = await tx.client.query(
      "SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'",
      [owner.sellerId, user.id],
    );
    if (self.rowCount) throw new SellerError("FORBIDDEN");
    const result = await tx.client.query<Thread>(
      `INSERT INTO treido.conversation_threads(id,listing_id,seller_id,buyer_id) VALUES($1,$2,$3,$4) ON CONFLICT(listing_id,seller_id,buyer_id) DO UPDATE SET listing_id=excluded.listing_id RETURNING ${columns}`,
      [randomUUID(), listingId, owner.sellerId, user.id],
    );
    return { id: result.rows[0].id };
  });
}

export async function sendConversationMessage(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
  scope?: InboxScope,
) {
  return inTransaction(database, (tx) =>
    sendConversationMessageInTransaction(tx, identity, input, scope),
  );
}
/** Lets an inquiry reply, workflow receipt and existing notification intent commit atomically. */
export async function sendConversationMessageInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  input: unknown,
  scope?: InboxScope,
) {
  const data = parseMessageInput(input);
  if (!data || (scope !== undefined && !parseInboxScope(scope)))
    throw new SellerError("INVALID_INPUT");
  const { thread, user } = await authorizeConversation(
    tx,
    identity,
    data.threadId,
    true,
    scope,
  );
  const hash = inputHash({
    body: data.body,
    attachmentIds: data.attachmentIds,
  });
  const previous = (
    await tx.client.query<{ id: string; sequence: number; hash: string }>(
      "SELECT id,sequence,input_hash AS hash FROM treido.messages WHERE thread_id=$1 AND author_id=$2 AND request_id=$3",
      [thread.id, user.id, data.requestId],
    )
  ).rows[0];
  if (previous) {
    if (previous.hash !== hash) throw new SellerError("CONFLICT");
    return { id: previous.id, sequence: previous.sequence };
  }
  const recent = await tx.client.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM treido.messages m JOIN treido.conversation_threads c ON c.id=m.thread_id WHERE c.seller_id=$1 AND c.buyer_id=$2 AND m.author_id=$3 AND m.created_at>clock_timestamp()-interval '1 minute'",
    [thread.sellerId, thread.buyerId, user.id],
  );
  if (recent.rows[0].count >= 30) throw new SellerError("QUOTA_EXCEEDED");
  for (const id of [...data.attachmentIds].sort()) {
    const asset = await tx.client.query(
      "SELECT id FROM treido.message_attachments a WHERE id=$1 AND thread_id=$2 AND created_by=$3 AND state='ready' AND purpose='private-message-images-v1' AND storage_scope IS NOT NULL AND ready_checksum IS NOT NULL AND ready_bytes IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL AND expires_at>clock_timestamp() AND operating_seller_id IS NOT DISTINCT FROM $4::uuid AND EXISTS(SELECT 1 FROM treido.message_attachment_objects o WHERE o.storage_scope=a.storage_scope AND o.object_key=a.object_key AND o.attachment_id=a.id AND o.kind='ready' AND o.state='tracked') AND NOT EXISTS(SELECT 1 FROM treido.message_attachment_links WHERE attachment_id=a.id) FOR UPDATE",
      [
        id,
        thread.id,
        user.id,
        scope?.sellerId ??
          (user.id === thread.buyerId ? null : thread.sellerId),
      ],
    );
    if (asset.rowCount !== 1) throw new SellerError("INVALID_INPUT");
  }
  const id = randomUUID();
  await tx.client.query(
    "INSERT INTO treido.messages(id,thread_id,author_id,sequence,body,request_id,input_hash) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      id,
      thread.id,
      user.id,
      thread.nextSequence,
      data.body,
      data.requestId,
      hash,
    ],
  );
  for (const assetId of data.attachmentIds)
    await tx.client.query(
      "INSERT INTO treido.message_attachment_links(thread_id,message_id,attachment_id) VALUES($1,$2,$3)",
      [thread.id, id, assetId],
    );
  await tx.client.query(
    "UPDATE treido.conversation_threads SET next_sequence=next_sequence+1,last_message_at=clock_timestamp() WHERE id=$1",
    [thread.id],
  );
  await tx.client.query(
    "INSERT INTO treido.message_notification_intents(thread_id,message_id,recipient_side) VALUES($1,$2,$3)",
    [thread.id, id, user.id === thread.buyerId ? "seller" : "buyer"],
  );
  return { id, sequence: thread.nextSequence };
}

export async function readConversationMessages(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  threadId: string,
  after = 0,
) {
  if (!Number.isSafeInteger(after) || after < 0)
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const { thread } = await authorizeConversation(tx, identity, threadId);
    const hidden = messageHiddenSql(await caseStorageReady(tx));
    const rows = await tx.client.query<{
      id: string;
      body: string;
      sequence: number;
      authorId: string;
      attachmentIds: string[];
    }>(
      `SELECT m.id,CASE WHEN ${hidden} THEN '' ELSE m.body END AS body,m.sequence,m.author_id AS "authorId",CASE WHEN ${hidden} THEN ARRAY[]::uuid[] ELSE ARRAY(SELECT attachment_id FROM treido.message_attachment_links WHERE message_id=m.id) END AS "attachmentIds" FROM treido.messages m WHERE m.thread_id=$1 AND m.sequence>$2 ORDER BY m.sequence LIMIT 50`,
      [thread.id, after],
    );
    return rows.rows;
  });
}

export async function readParticipantAttachment(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  threadId: string,
  attachmentId: string,
) {
  if (!validId(attachmentId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeConversation(tx, identity, threadId);
    if (await imageTombstoned(tx, attachmentId))
      throw new SellerError("NOT_FOUND");
    const hidden = messageHiddenSql(await caseStorageReady(tx));
    const suppressed = await tx.client.query(
      `SELECT m.id FROM treido.message_attachment_links link JOIN treido.messages m ON m.id=link.message_id WHERE link.attachment_id=$1 AND m.thread_id=$2 AND ${hidden}`,
      [attachmentId, threadId],
    );
    if (suppressed.rowCount) throw new SellerError("NOT_FOUND");
    const row = (
      await tx.client.query<{ objectKey: string; contentType: string }>(
        "SELECT object_key AS \"objectKey\",'image/webp' AS \"contentType\" FROM treido.message_attachments a WHERE id=$1 AND thread_id=$2 AND state='ready' AND purpose='private-message-images-v1' AND storage_scope IS NOT NULL AND ready_checksum IS NOT NULL AND EXISTS(SELECT 1 FROM treido.message_attachment_links WHERE attachment_id=a.id) AND EXISTS(SELECT 1 FROM treido.message_attachment_objects o WHERE o.storage_scope=a.storage_scope AND o.object_key=a.object_key AND o.state='tracked')",
        [attachmentId, threadId],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    // Server-only storage adapter input. No object key enters the message view.
    return row;
  });
}
