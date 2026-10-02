import "server-only";
import {
  publishedJoins,
  publishedEligibility,
} from "../catalog/publication-eligibility.server";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, authorizeSeller } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { parseInboxScope, type InboxScope } from "./inbox-model";
export type Thread = {
  id: string;
  sellerId: string;
  listingId: string;
  buyerId: string;
  state: "open" | "closed";
  nextSequence: number;
};
export type ContactPreference = {
  buyerBlocked: boolean;
  sellerBlocked: boolean;
  revision: number;
};
export const threadColumns =
  'id,seller_id AS "sellerId",listing_id AS "listingId",buyer_id AS "buyerId",state,next_sequence AS "nextSequence"';
/** The contact row serializes blocks with sends across every listing for this pair. */
export async function authorizeConversation(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  threadId: string,
  mode: boolean | "contact" = false,
  scope?: InboxScope,
) {
  if (!validId(threadId) || (scope !== undefined && !parseInboxScope(scope)))
    throw new SellerError("INVALID_INPUT");
  const user = await authorizeHuman(tx, identity, false);
  const thread = (
    await tx.client.query<Thread>(
      "SELECT " +
        threadColumns +
        " FROM treido.conversation_threads WHERE id=$1",
      [threadId],
    )
  ).rows[0];
  if (!thread) throw new SellerError("NOT_FOUND");
  const side: "buyer" | "seller" =
    scope === undefined
      ? thread.buyerId === user.id
        ? "buyer"
        : "seller"
      : scope.sellerId === null
        ? "buyer"
        : "seller";
  let mayReply = true,
    sellerStatus: string;
  if (side === "seller") {
    if (
      (scope && scope.sellerId !== thread.sellerId) ||
      thread.buyerId === user.id
    )
      throw new SellerError("NOT_FOUND");
    try {
      const access = await authorizeSeller(
        tx,
        identity,
        thread.sellerId,
        mode ? "inbox.reply" : "inbox.read",
      );
      mayReply = access.context.capabilities.includes("inbox.reply");
      sellerStatus = access.seller.status;
    } catch (error) {
      if (error instanceof SellerError) throw new SellerError("NOT_FOUND");
      throw error;
    }
  } else {
    if (thread.buyerId !== user.id) throw new SellerError("NOT_FOUND");
    sellerStatus =
      (
        await tx.client.query<{ status: string }>(
          "SELECT status FROM treido.seller_accounts WHERE id=$1 FOR SHARE",
          [thread.sellerId],
        )
      ).rows[0]?.status ?? "closed";
  }
  const contact = (
    await tx.client.query<ContactPreference>(
      'SELECT buyer_blocked AS "buyerBlocked",seller_blocked AS "sellerBlocked",revision FROM treido.contact_preferences WHERE seller_id=$1 AND buyer_id=$2 FOR ' +
        (mode ? "UPDATE" : "SHARE"),
      [thread.sellerId, thread.buyerId],
    )
  ).rows[0];
  if (!contact) throw new SellerError("NOT_AVAILABLE");
  const listing = (
    await tx.client.query<{ publication: string; moderation: string }>(
      "SELECT publication,moderation_state AS moderation FROM treido.listings WHERE id=$1 AND seller_id=$2 FOR SHARE",
      [thread.listingId, thread.sellerId],
    )
  ).rows[0];
  const policy = await tx.client.query(
    "SELECT l.id " +
      publishedJoins +
      " WHERE l.id=$1 AND l.seller_id=$2 AND " +
      publishedEligibility,
    [thread.listingId, thread.sellerId],
  );
  const locked = (
    await tx.client.query<Thread>(
      "SELECT " +
        threadColumns +
        " FROM treido.conversation_threads WHERE id=$1 FOR " +
        (mode === true ? "UPDATE" : "SHARE"),
      [thread.id],
    )
  ).rows[0];
  if (!locked) throw new SellerError("NOT_FOUND");
  const self =
    side === "buyer"
      ? await tx.client.query(
          "SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'",
          [thread.sellerId, user.id],
        )
      : null;
  const canReply =
    !self?.rowCount &&
    mayReply &&
    sellerStatus === "active" &&
    locked.state === "open" &&
    listing?.publication === "published" &&
    listing.moderation === "clear" &&
    policy.rowCount === 1 &&
    !contact.buyerBlocked &&
    !contact.sellerBlocked;
  if (mode === true && !canReply) throw new SellerError("NOT_AVAILABLE");
  return {
    thread: locked,
    user,
    side,
    canReply,
    canBlock: mayReply,
    contact,
    titleVisible: listing?.moderation === "clear",
  };
}
