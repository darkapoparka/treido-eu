import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, authorizeSeller } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { caseStorageReady } from "./case-storage.server";
import type { CaseOutcome } from "./case-model";
import type { ModerationState } from "./moderation-model";
export type DecisionUpdate = {
  id: string;
  targetId: string;
  kind: "report" | "appeal" | "message" | "listing";
  outcome: CaseOutcome | ModerationState;
  reason: string;
  at: string;
};
export type DecisionUpdates = {
  actorKey: string;
  sellerId: string | null;
  available: boolean;
  canReadListings: boolean;
  items: DecisionUpdate[];
};
export async function readDecisionUpdates(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string | null,
): Promise<DecisionUpdates> {
  if (sellerId !== null && !validId(sellerId))
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    let user;
    try {
      user = sellerId
        ? (await authorizeSeller(tx, identity, sellerId, "inbox.read")).user
        : await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (
        sellerId === null &&
        error instanceof SellerError &&
        error.code === "NOT_FOUND"
      )
        return {
          actorKey: libraryActorKey(identity),
          sellerId,
          available: await caseStorageReady(tx),
          canReadListings: false,
          items: [],
        };
      throw error;
    }
    const available = await caseStorageReady(tx);
    let canReadListings = false;
    if (sellerId) {
      try {
        await authorizeSeller(tx, identity, sellerId, "listing.read");
        canReadListings = true;
      } catch (error) {
        if (!(error instanceof SellerError) || error.code !== "FORBIDDEN")
          throw error;
      }
    }
    const parts: string[] = [];
    if (sellerId === null) {
      parts.push(`SELECT a.id,r.id AS target_id,'listing'::text AS kind,a.next_state AS outcome,a.reason,a.created_at AS occurred
        FROM treido.moderation_actions a JOIN treido.reports r ON r.id=a.report_id WHERE r.reporter_id=$1 AND $2::uuid IS NULL`);
      if (available)
        parts.push(`SELECT d.id,d.case_id AS target_id,CASE WHEN d.kind='appeal' THEN 'appeal' ELSE 'report' END AS kind,d.outcome,d.reason,d.created_at AS occurred
        FROM treido.trust_case_decisions d LEFT JOIN treido.reports r ON r.id=d.report_id LEFT JOIN treido.moderation_appeals x ON x.id=d.appeal_id
        WHERE (r.reporter_id=$1 OR x.actor_id=$1) AND $2::uuid IS NULL`);
    } else if (canReadListings) {
      parts.push(`SELECT a.id,a.listing_id AS target_id,'listing'::text AS kind,a.next_state AS outcome,a.reason,a.created_at AS occurred
        FROM treido.moderation_actions a JOIN treido.listings l ON l.id=a.listing_id WHERE l.seller_id=$2 AND $1::uuid IS NOT NULL`);
      if (available)
        parts.push(`SELECT d.id,x.id AS target_id,'appeal'::text AS kind,d.outcome,d.reason,d.created_at AS occurred
        FROM treido.trust_case_decisions d JOIN treido.moderation_appeals x ON x.id=d.appeal_id JOIN treido.moderation_actions a ON a.id=x.action_id
        JOIN treido.listings l ON l.id=a.listing_id WHERE x.actor_id=$1 AND l.seller_id=$2`);
    }
    if (available)
      parts.push(`SELECT ma.id,c.id AS target_id,'message'::text AS kind,'message_hidden'::text AS outcome,ma.reason,ma.created_at AS occurred
      FROM treido.message_moderation_actions ma JOIN treido.messages m ON m.id=ma.message_id JOIN treido.conversation_threads c ON c.id=m.thread_id
      WHERE ma.state='hidden' AND CASE WHEN $2::uuid IS NULL THEN c.buyer_id=$1
        AND NOT EXISTS(SELECT 1 FROM treido.personal_seller_owners own WHERE own.seller_id=c.seller_id AND own.user_id=$1)
        AND NOT EXISTS(SELECT 1 FROM treido.seller_memberships sm WHERE sm.seller_id=c.seller_id AND sm.user_id=$1 AND sm.status='active')
        ELSE c.seller_id=$2 AND c.buyer_id<>$1 END`);
    const items = parts.length
      ? (
          await tx.client.query<DecisionUpdate>(
            `SELECT id,target_id AS "targetId",kind,outcome,reason,to_char(occurred AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
       FROM (${parts.join(" UNION ALL ")}) events ORDER BY occurred DESC,id DESC,kind DESC LIMIT 10`,
            [user.id, sellerId],
          )
        ).rows
      : [];
    return {
      actorKey: libraryActorKey(identity),
      sellerId,
      available,
      canReadListings,
      items,
    };
  });
}
