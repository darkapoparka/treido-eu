import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { inputHash } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { SellerError } from "../sellers/errors";
import { exact, boundedText, revision } from "../order-aftercare/model";
import { authorizeAftercareOperator } from "../order-aftercare/operators.server";
export function parseFeedbackDecision(raw: unknown) {
  if (
    !object(raw) ||
    typeof raw.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey) ||
    !validId(raw.feedbackId) ||
    !validId(raw.requestId) ||
    (raw.decision !== "publish" && raw.decision !== "hide")
  )
    throw new SellerError("INVALID_INPUT");
  exact(raw, [
    "actorKey",
    "feedbackId",
    "requestId",
    "expectedRevision",
    "decision",
    "reason",
  ]);
  return {
    actorKey: raw.actorKey,
    feedbackId: raw.feedbackId,
    requestId: raw.requestId,
    expectedRevision: revision(raw.expectedRevision),
    decision: raw.decision,
    reason: boundedText(raw.reason, 1000),
  };
}
export async function moderateOrderFeedback(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseFeedbackDecision(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const access = await authorizeAftercareOperator(
      tx,
      identity,
      "feedback.moderate",
      true,
    );
    const row = (
      await tx.client.query<{ revision: number }>(
        "SELECT treido.moderate_order_feedback($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS revision",
        [
          access.user.id,
          command.feedbackId,
          command.requestId,
          command.expectedRevision,
          command.decision,
          command.reason,
          inputHash(command),
          access.environment,
          access.applicationId,
          randomUUID(),
        ],
      )
    ).rows[0];
    return { feedbackId: command.feedbackId, revision: row.revision };
  });
}
export async function readFeedbackModeration(
  database: SellerDatabase,
  identity: VerifiedIdentity,
) {
  return inTransaction(database, async (tx) => {
    const access = await authorizeAftercareOperator(
      tx,
      identity,
      "feedback.moderate",
    );
    const rows = (
      await tx.client.query<{
        id: string;
        rating: number;
        body: string;
        state: string;
        revision: number;
        createdAt: Date;
      }>(
        'SELECT f.id,f.rating,f.body,f.state,f.revision,f.created_at AS "createdAt" FROM treido.order_purchase_feedback f JOIN treido.order_feedback_policies p ON p.id=f.policy_id WHERE p.environment=$1 AND p.application_id=$2 ORDER BY f.created_at DESC,f.id DESC LIMIT 51',
        [access.environment, access.applicationId],
      )
    ).rows;
    return {
      actorKey: libraryActorKey(identity),
      actorSubject: identity.subject,
      feedback: rows
        .slice(0, 50)
        .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      more: rows.length > 50,
    };
  });
}
