import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { authorizeOperator } from "./reports.server";
import {
  caseStorageReady,
  readCaseDecision,
  readMessageModeration,
} from "./case-storage.server";
import type { CaseContext, TrustCaseKind } from "./case-model";
import type { ModerationState } from "./moderation-model";

export async function readCaseContextInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  kind: TrustCaseKind,
  caseId: string,
): Promise<CaseContext> {
  if (!validId(caseId) || !["message_report", "appeal"].includes(kind))
    throw new SellerError("INVALID_INPUT");
  const user = await authorizeOperator(tx, identity, "reports.read");
  const available = await caseStorageReady(tx);
  const decision = available ? await readCaseDecision(tx, kind, caseId) : null;
  let resourceId: string,
    originalActionId: string | null = null,
    revision = 1;
  let resourceRevision: number,
    state: CaseContext["state"],
    status: CaseContext["status"] = decision ? "resolved" : "open";
  if (kind === "message_report") {
    const report = (
      await tx.client.query<{
        resourceId: string;
        revision: number;
        state: string;
      }>(
        `SELECT r.resource_id AS "resourceId",r.revision,r.state FROM treido.reports r JOIN treido.messages m ON m.id=r.resource_id WHERE r.id=$1 AND r.resource_kind='message'`,
        [caseId],
      )
    ).rows[0];
    if (!report) throw new SellerError("NOT_FOUND");
    resourceId = report.resourceId;
    revision = report.revision;
    if (report.state === "reviewed") status = "resolved";
    const message = await readMessageModeration(tx, resourceId, available);
    resourceRevision = message.revision;
    state = message.state;
  } else {
    const appeal = (
      await tx.client.query<{
        resourceId: string;
        originalActionId: string;
        revision: number;
        state: ModerationState;
      }>(
        `SELECT a.listing_id AS "resourceId",a.id AS "originalActionId",l.moderation_revision AS revision,l.moderation_state AS state
       FROM treido.moderation_appeals x JOIN treido.moderation_actions a ON a.id=x.action_id JOIN treido.listings l ON l.id=a.listing_id WHERE x.id=$1`,
        [caseId],
      )
    ).rows[0];
    if (!appeal) throw new SellerError("NOT_FOUND");
    resourceId = appeal.resourceId;
    originalActionId = appeal.originalActionId;
    resourceRevision = appeal.revision;
    state = appeal.state;
    revision = decision?.revision ?? 1;
  }
  const grant =
    (
      await tx.client.query<{ allowed: boolean }>(
        "SELECT treido.lock_operator_grant($1,'moderation.write') AS allowed",
        [user.id],
      )
    ).rows[0]?.allowed === true;
  return {
    actorKey: libraryActorKey(identity),
    kind,
    caseId,
    resourceId,
    originalActionId,
    revision,
    resourceRevision,
    state,
    status,
    available,
    canDecide: available && grant && status === "open",
    decision,
  };
}
export async function readCaseContext(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  kind: TrustCaseKind,
  caseId: string,
) {
  return inTransaction(database, (tx) =>
    readCaseContextInTransaction(tx, identity, kind, caseId),
  );
}
