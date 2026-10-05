import { libraryActorKey } from "../library/cursor.server";
import {
  caseStorageReady,
  readCaseDecision,
  caseDecisionColumns,
} from "./case-storage.server";
import type { CaseDecision } from "./case-model";
import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, authorizeSeller } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { authorizeConversation } from "../messaging/conversation-access.server";
import { readPublicListingState } from "./moderation.server";
export type ReportSummary = {
  id: string;
  resourceKind: "listing" | "message";
  resourceId: string;
  reason: "unsafe" | "counterfeit" | "misleading" | "abuse" | "other";
  state: "open" | "reviewed";
  createdAt: string;
};
export type DecisionView = {
  viewer: { actorKey: string; actorSubject: string };
  id: string;
  listingId: string;
  state: "clear" | "restricted" | "removed";
  reason: string;
  createdAt: string;
  appeals: {
    id: string;
    details: string;
    createdAt: string;
    decision: CaseDecision | null;
  }[];
};
export async function readReportTarget(
  database: SellerDatabase,
  actor: VerifiedIdentity,
  kind: unknown,
  id: unknown,
) {
  if (!validId(id) || !["listing", "message"].includes(String(kind)))
    throw new SellerError("INVALID_INPUT");
  if (kind === "listing") {
    await readPublicListingState(database, id);
    return { resourceKind: "listing" as const, resourceId: id };
  }
  return inTransaction(database, async (tx) => {
    const row = (
      await tx.client.query<{ threadId: string }>(
        'SELECT thread_id AS "threadId" FROM treido.messages WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    await authorizeConversation(tx, actor, row.threadId);
    return { resourceKind: "message" as const, resourceId: id };
  });
}
export async function listOwnReports(
  database: SellerDatabase,
  actor: VerifiedIdentity,
  before: string | null = null,
) {
  if (before !== null && !validId(before))
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    let user;
    try {
      user = await authorizeHuman(tx, actor, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return { items: [], nextCursor: null };
      throw error;
    }
    const position = before
      ? (
          await tx.client.query<{ at: string; id: string }>(
            `SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,id FROM treido.reports WHERE id=$1 AND reporter_id=$2`,
            [before, user.id],
          )
        ).rows[0]
      : null;
    if (before && !position) throw new SellerError("INVALID_INPUT");
    const items = (
      await tx.client.query<ReportSummary>(
        `SELECT id,resource_kind AS "resourceKind",resource_id AS "resourceId",reason,state,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
       FROM treido.reports WHERE reporter_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT 31`,
        [user.id, position?.at ?? null, position?.id ?? null],
      )
    ).rows;
    return {
      items: items.slice(0, 30),
      nextCursor: items.length > 30 ? items[29].id : null,
    };
  });
}
async function decisions(
  tx: import("../../server/db/database").SellerTransaction,
  userId: string,
  where: string,
  params: string[],
): Promise<DecisionView[]> {
  // Call sites supply fixed SQL predicates; no browser SQL is accepted.
  return (
    await tx.client.query<DecisionView>(
      `SELECT a.id,a.listing_id AS "listingId",a.next_state AS state,a.reason,to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
      coalesce((SELECT json_agg(json_build_object('id',x.id,'details',x.details,'createdAt',to_char(x.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY x.created_at DESC) FROM (SELECT id,details,created_at FROM treido.moderation_appeals WHERE action_id=a.id AND actor_id=$1 ORDER BY created_at DESC,id DESC LIMIT 10) x),'[]'::json) AS appeals
      FROM treido.moderation_actions a WHERE ` +
        where +
        " ORDER BY a.created_at DESC,a.id DESC LIMIT 30",
      [userId, ...params],
    )
  ).rows;
}
async function ownOutcomes(
  tx: import("../../server/db/database").SellerTransaction,
  actor: VerifiedIdentity,
  userId: string,
  items: DecisionView[],
) {
  const ids = items.flatMap((item) => item.appeals.map((appeal) => appeal.id));
  const available = await caseStorageReady(tx);
  const outcomes =
    ids.length && available
      ? (
          await tx.client.query<CaseDecision>(
            `SELECT ${caseDecisionColumns} FROM treido.trust_case_decisions d JOIN treido.moderation_appeals x ON x.id=d.appeal_id WHERE x.actor_id=$1 AND x.id=ANY($2::uuid[])`,
            [userId, ids],
          )
        ).rows
      : [];
  const byId = new Map(outcomes.map((value) => [value.caseId, value]));
  return items.map((item) => ({
    ...item,
    viewer: { actorKey: libraryActorKey(actor), actorSubject: actor.subject },
    appeals: item.appeals.map((appeal) => ({
      ...appeal,
      decision: byId.get(appeal.id) ?? null,
    })),
  }));
}
export async function readReportDetail(
  database: SellerDatabase,
  actor: VerifiedIdentity,
  id: string,
) {
  if (!validId(id)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, actor, false);
    const report = (
      await tx.client.query<ReportSummary & { details: string }>(
        `SELECT id,resource_kind AS "resourceKind",resource_id AS "resourceId",reason,details,state,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt" FROM treido.reports WHERE id=$1 AND reporter_id=$2`,
        [id, user.id],
      )
    ).rows[0];
    if (!report) throw new SellerError("NOT_FOUND");
    return {
      report,
      decisions: await ownOutcomes(
        tx,
        actor,
        user.id,
        await decisions(tx, user.id, "a.report_id=$2", [id]),
      ),
      formalDecision:
        report.resourceKind === "message" && (await caseStorageReady(tx))
          ? await readCaseDecision(tx, "message_report", id)
          : null,
    };
  });
}
export async function readSellerDecisions(
  database: SellerDatabase,
  actor: VerifiedIdentity,
  sellerId: string,
  listingId: string,
) {
  if (!validId(listingId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const { user } = await authorizeSeller(tx, actor, sellerId, "listing.read");
    const listing = await tx.client.query(
      "SELECT id FROM treido.listings WHERE seller_id=$1 AND id=$2 FOR SHARE",
      [sellerId, listingId],
    );
    if (listing.rowCount !== 1) throw new SellerError("NOT_FOUND");
    return ownOutcomes(
      tx,
      actor,
      user.id,
      await decisions(tx, user.id, "a.listing_id=$2", [listingId]),
    );
  });
}
