import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { authorizeConversation } from "../messaging/conversation-access.server";
import {
  caseStorageReady,
  messageHiddenSql,
} from "../trust/case-storage.server";
import { criteriaIntent } from "../saved-searches/model";
import { buildToolQuery } from "../shopping-tools/catalogue-sql.server";
import type { NotificationLanguage } from "./model";
export type NotificationSource = {
  userId: string;
  kind: "saved-search" | "message";
  sourceId: string;
  sourceRevision: number;
  sellerId: string | null;
  language: NotificationLanguage;
};
/** No message, listing title, sender, address or seller name enters an email payload. */
export async function notificationSourceLink(
  tx: SellerTransaction,
  source: NotificationSource,
  subject: string,
): Promise<string> {
  if (source.kind === "message") {
    const original = (
      await tx.client.query<{
        threadId: string;
        sequence: number;
        recipientSide: string;
        authorId: string;
      }>(
        `SELECT m.thread_id AS "threadId",m.sequence,n.recipient_side AS "recipientSide",m.author_id AS "authorId" FROM treido.messages m JOIN treido.message_notification_intents n ON n.message_id=m.id AND n.thread_id=m.thread_id WHERE m.id=$1`,
        [source.sourceId],
      )
    ).rows[0];
    if (
      !original ||
      original.sequence !== source.sourceRevision ||
      original.authorId === source.userId ||
      original.recipientSide !== (source.sellerId ? "seller" : "buyer")
    )
      throw new SellerError("FORBIDDEN");
    const access = await authorizeConversation(
      tx,
      { subject },
      original.threadId,
      false,
      { sellerId: source.sellerId },
    );
    if (
      access.user.id !== source.userId ||
      access.contact.buyerBlocked ||
      access.contact.sellerBlocked ||
      !access.titleVisible
    )
      throw new SellerError("FORBIDDEN");
    const moderationReady = await caseStorageReady(tx);
    if (
      (
        await tx.client.query(
          `SELECT m.id FROM treido.messages m WHERE m.id=$1 AND NOT (${messageHiddenSql(moderationReady, "m")})`,
          [source.sourceId],
        )
      ).rowCount !== 1
    )
      throw new SellerError("FORBIDDEN");
    return source.sellerId
      ? `/app/sellers/${source.sellerId}/inbox/${original.threadId}?lang=${source.language}`
      : `/messages/${original.threadId}?lang=${source.language}`;
  }
  const original = (
    await tx.client.query<{ listingId: string; criteria: unknown }>(
      `SELECT n.listing_id AS "listingId",v.criteria FROM treido.buyer_search_notifications n JOIN treido.buyer_saved_searches s ON s.id=n.search_id AND s.user_id=n.user_id JOIN treido.buyer_saved_search_versions v ON v.search_id=s.id AND v.user_id=s.user_id AND v.version=s.criteria_version
    WHERE n.id=$1 AND n.user_id=$2 AND n.consent_generation=$3 AND n.consent_generation=s.consent_generation AND n.criteria_version=s.criteria_version AND s.status='enabled' AND s.consent_at IS NOT NULL AND n.kind<>'unavailable'
    AND NOT EXISTS(SELECT 1 FROM treido.listings l JOIN treido.contact_preferences cp ON cp.seller_id=l.seller_id AND cp.buyer_id=$2 WHERE l.id=n.listing_id AND (cp.buyer_blocked OR cp.seller_blocked)) FOR SHARE OF s`,
      [source.sourceId, source.userId, source.sourceRevision],
    )
  ).rows[0];
  const intent = original
    ? criteriaIntent(original.criteria as Parameters<typeof criteriaIntent>[0])
    : null;
  if (!original || !intent || source.sellerId !== null)
    throw new SellerError("FORBIDDEN");
  const listing = (
    await tx.client.query<{ sellerId: string }>(
      `SELECT seller_id AS "sellerId" FROM treido.listings WHERE id=$1`,
      [original.listingId],
    )
  ).rows[0];
  if (!listing) throw new SellerError("FORBIDDEN");
  await tx.client.query(
    `SELECT id FROM treido.seller_accounts WHERE id=$1 FOR SHARE`,
    [listing.sellerId],
  );
  const contact = (
    await tx.client.query<{ blocked: boolean }>(
      `SELECT buyer_blocked OR seller_blocked AS blocked FROM treido.contact_preferences WHERE seller_id=$1 AND buyer_id=$2 FOR SHARE`,
      [listing.sellerId, source.userId],
    )
  ).rows[0];
  if (contact?.blocked) throw new SellerError("FORBIDDEN");
  // Hold the same mutable listing/contact parents as publication and block commands.
  await tx.client.query(
    `SELECT id FROM treido.listings WHERE id=$1 AND seller_id=$2 FOR SHARE`,
    [original.listingId, listing.sellerId],
  );
  if (
    (
      await tx.client.query(
        buildToolQuery({ ...intent, cursor: null }, null, {
          ids: [original.listingId],
        }),
      )
    ).rowCount !== 1
  )
    throw new SellerError("FORBIDDEN");
  return `/minis/saved-searches?lang=${source.language}`;
}
