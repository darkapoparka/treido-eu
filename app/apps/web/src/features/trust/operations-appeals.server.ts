import { caseStorageReady } from "./case-storage.server";
import { readCaseContextInTransaction } from "./case-context.server";
import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { authorizeOperator } from "./reports.server";
import {
  readOperationContextInTransaction,
  readOperationDecisions,
  moderationSearch,
} from "./operations-context.server";
import {
  parseAppealQuery,
  type AppealItem,
  type ListingOperation,
} from "./operations-model";
const appealFrom = `FROM treido.moderation_appeals x JOIN treido.moderation_actions a ON a.id=x.action_id
 JOIN treido.listings l ON l.id=a.listing_id
 LEFT JOIN treido.listing_publications p ON p.seller_id=l.seller_id AND p.listing_id=l.id AND p.revision=l.current_publication_revision`;
const decisionJoin = (ready: boolean) =>
  ready
    ? "LEFT JOIN treido.trust_case_decisions cd ON cd.appeal_id=x.id"
    : "LEFT JOIN (SELECT NULL::uuid AS appeal_id,NULL::uuid AS id) cd ON cd.appeal_id=x.id";
const appealColumns = `CASE WHEN cd.id IS NULL THEN 'open' ELSE 'resolved' END AS resolution,x.id,x.action_id AS "actionId",a.listing_id AS "listingId",p.payload->>'title' AS title,x.details,
 to_char(x.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
 a.accepted_revision AS "appealedRevision",l.moderation_revision AS "currentRevision",a.next_state AS "appealedState",l.moderation_state AS "currentState"`;
export async function readAppealQueue(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const query = parseAppealQuery(raw);
  return inTransaction(database, async (tx) => {
    await authorizeOperator(tx, identity, "reports.read");
    const available = await caseStorageReady(tx);
    if (
      query.before &&
      !(
        await tx.client.query(
          "SELECT id FROM treido.moderation_appeals WHERE id=$1",
          [query.before],
        )
      ).rowCount
    )
      throw new SellerError("INVALID_INPUT");
    const rows = (
      await tx.client.query<AppealItem>(
        `SELECT ${appealColumns} ${appealFrom} ${decisionJoin(available)}
       WHERE ($1='all' OR ($1='open' AND cd.id IS NULL) OR ($1='resolved' AND cd.id IS NOT NULL) OR ($1='current' AND a.accepted_revision=l.moderation_revision) OR ($1='superseded' AND a.accepted_revision<l.moderation_revision))
       AND ($2='' OR ${moderationSearch("coalesce(p.payload->>'title','') || ' ' || x.details", "$2")})
       AND ($3::uuid IS NULL OR (x.created_at,x.id)<(SELECT created_at,id FROM treido.moderation_appeals WHERE id=$3))
       ORDER BY x.created_at DESC,x.id DESC LIMIT 21`,
        [query.state, query.q, query.before],
      )
    ).rows;
    return {
      actorKey: libraryActorKey(identity),
      available,
      query,
      items: rows.slice(0, 20),
      nextBefore: rows.length > 20 ? rows[19].id : null,
    };
  });
}
export async function readListingOperation(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  listingId: string,
  before: string | null = null,
): Promise<ListingOperation> {
  if (before !== null && !validId(before))
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const { listing, context, userId } =
      await readOperationContextInTransaction(tx, identity, listingId, null);
    const available = await caseStorageReady(tx);
    if (
      before &&
      !(
        await tx.client.query(
          "SELECT x.id FROM treido.moderation_appeals x JOIN treido.moderation_actions a ON a.id=x.action_id WHERE x.id=$1 AND a.listing_id=$2",
          [before, listingId],
        )
      ).rowCount
    )
      throw new SellerError("INVALID_INPUT");
    const rows = (
      await tx.client.query<AppealItem>(
        `SELECT ${appealColumns} ${appealFrom} ${decisionJoin(available)} WHERE l.id=$1
       AND ($2::uuid IS NULL OR (x.created_at,x.id)<(SELECT created_at,id FROM treido.moderation_appeals WHERE id=$2))
       ORDER BY x.created_at DESC,x.id DESC LIMIT 21`,
        [listingId, before],
      )
    ).rows;
    return {
      actorKey: context.actorKey,
      listing,
      context,
      decisions: await readOperationDecisions(tx, userId, listingId),
      appeals: rows.slice(0, 20),
      nextAppeal: rows.length > 20 ? rows[19].id : null,
    };
  });
}

export async function readOperationAppeal(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  appealId: string,
) {
  if (!validId(appealId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeOperator(tx, identity, "reports.read");
    const available = await caseStorageReady(tx);
    const appeal = (
      await tx.client.query<AppealItem>(
        `SELECT ${appealColumns} ${appealFrom} ${decisionJoin(available)} WHERE x.id=$1`,
        [appealId],
      )
    ).rows[0];
    if (!appeal) throw new SellerError("NOT_FOUND");
    const { listing, context, userId } =
      await readOperationContextInTransaction(
        tx,
        identity,
        appeal.listingId,
        null,
      );
    const original = (
      await tx.client.query<import("./operations-model").OperationDecision>(
        `SELECT id,report_id AS "reportId",prior_state AS "from",next_state AS "to",accepted_revision AS revision,reason,
       to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,actor_id=$2 AS own
       FROM treido.moderation_actions WHERE id=$1`,
        [appeal.actionId, userId],
      )
    ).rows[0];
    if (!original) throw new SellerError("NOT_FOUND");
    return {
      actorKey: context.actorKey,
      caseContext: await readCaseContextInTransaction(
        tx,
        identity,
        "appeal",
        appealId,
      ),
      appeal: {
        ...appeal,
        currentState: listing.state,
        currentRevision: listing.revision,
      },
      listing,
      context,
      original,
    };
  });
}
