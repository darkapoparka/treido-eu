import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { parseOwnCaseQuery } from "./own-case-query";
import {
  encodeOwnCaseCursor,
  decodeOwnCaseCursor,
  type OwnCaseTopic,
  type OwnCasePosition,
} from "./own-case-cursor.server";
import {
  caseStorageReady,
  caseDecisionColumns,
  readCaseDecision,
} from "./case-storage.server";
import { moderationSearch } from "./operations-context.server";
import type { CaseDecision } from "./case-model";
import type { ModerationState } from "./moderation-model";
export type OwnCaseItem = {
  id: string;
  resourceId: string;
  resourceKind: "listing" | "message";
  at: string;
  details: string;
  reason: string;
  state: "open" | "resolved";
  decision: CaseDecision | null;
};
async function ownUser(tx: SellerTransaction, identity: VerifiedIdentity) {
  try {
    return await authorizeHuman(tx, identity, false);
  } catch (error) {
    if (error instanceof SellerError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}
export async function readOwnCaseQueue(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  topic: OwnCaseTopic,
  raw: unknown,
) {
  const query = parseOwnCaseQuery(raw),
    actorKey = libraryActorKey(identity);
  const legacy = validId(query.before) ? query.before : null;
  if (
    legacy &&
    (topic !== "reports" ||
      query.state !== "all" ||
      query.kind !== "all" ||
      query.q)
  )
    throw new SellerError("INVALID_INPUT");
  const signedPosition = legacy
    ? null
    : decodeOwnCaseCursor(actorKey, topic, query);
  if (topic === "appeals" && query.kind !== "all")
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await ownUser(tx, identity),
      available = await caseStorageReady(tx);
    if (!user) {
      if (legacy) throw new SellerError("INVALID_INPUT");
      return { query, available, items: [] as OwnCaseItem[], nextBefore: null };
    }
    let position: OwnCasePosition | null = signedPosition;
    const ceiling =
      position?.ceiling ??
      (
        await tx.client.query<{ at: string }>(
          `SELECT to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at`,
        )
      ).rows[0].at;
    if (legacy) {
      // Preserve old unfiltered own-report links without granting a cursor over
      // another human's history. All newly emitted pages use signed scope.
      const anchor = (
        await tx.client.query<{ id: string; at: string }>(
          `SELECT id,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at FROM treido.reports WHERE id=$1 AND reporter_id=$2`,
          [legacy, user.id],
        )
      ).rows[0];
      if (!anchor || anchor.at > ceiling)
        throw new SellerError("INVALID_INPUT");
      position = { ...anchor, ceiling };
    }
    const isReport = topic === "reports";
    const state = isReport
      ? "CASE WHEN x.state='open' THEN 'open' ELSE 'resolved' END"
      : available
        ? "CASE WHEN EXISTS(SELECT 1 FROM treido.trust_case_decisions cd WHERE cd.appeal_id=x.id) THEN 'resolved' ELSE 'open' END"
        : "'open'::text";
    const resource = isReport ? "x.resource_id" : "a.listing_id",
      kind = isReport ? "x.resource_kind" : "'listing'::text";
    const decision = available
      ? `(SELECT row_to_json(safe) FROM (SELECT ${caseDecisionColumns} FROM treido.trust_case_decisions d WHERE d.${isReport ? "report_id" : "appeal_id"}=x.id) safe)`
      : "NULL::json";
    const rows = (
      await tx.client.query<OwnCaseItem>(
        `SELECT x.id,${resource} AS "resourceId",${kind} AS "resourceKind",left(x.details,400) AS details,
       ${isReport ? "x.reason" : "a.reason"} AS reason,${state} AS state,${decision} AS decision,
       to_char(x.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
       FROM treido.${isReport ? "reports x" : "moderation_appeals x JOIN treido.moderation_actions a ON a.id=x.action_id"}
       WHERE x.${isReport ? "reporter_id" : "actor_id"}=$1 AND ($2='all' OR ${state}=$2) AND ($3='all' OR ${kind}=$3)
       AND ($4='' OR ${moderationSearch("x.details || ' ' || " + (isReport ? "x.reason" : "a.reason"), "$4")})
       AND x.created_at<=$5::timestamptz AND ($6::timestamptz IS NULL OR (x.created_at,x.id)<($6::timestamptz,$7::uuid))
       ORDER BY x.created_at DESC,x.id DESC LIMIT 21`,
        [
          user.id,
          query.state,
          query.kind,
          query.q,
          ceiling,
          position?.at ?? null,
          position?.id ?? null,
        ],
      )
    ).rows;
    const items = rows.slice(0, 20),
      last = items.at(-1);
    return {
      query,
      available,
      items,
      nextBefore:
        rows.length > 20 && last
          ? encodeOwnCaseCursor(
              { id: last.id, at: last.at, ceiling },
              actorKey,
              topic,
              query,
            )
          : null,
    };
  });
}
export async function readOwnAppeal(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  appealId: string,
) {
  if (!validId(appealId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const appeal = (
      await tx.client.query<{
        id: string;
        actionId: string;
        listingId: string;
        details: string;
        at: string;
        originalState: ModerationState;
        originalReason: string;
        originalRevision: number;
      }>(
        `SELECT x.id,x.action_id AS "actionId",a.listing_id AS "listingId",x.details,
       to_char(x.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
       a.next_state AS "originalState",a.reason AS "originalReason",a.accepted_revision AS "originalRevision"
       FROM treido.moderation_appeals x JOIN treido.moderation_actions a ON a.id=x.action_id WHERE x.id=$1 AND x.actor_id=$2`,
        [appealId, user.id],
      )
    ).rows[0];
    if (!appeal) throw new SellerError("NOT_FOUND");
    const available = await caseStorageReady(tx);
    return {
      appeal,
      available,
      decision: available
        ? await readCaseDecision(tx, "appeal", appealId)
        : null,
    };
  });
}
