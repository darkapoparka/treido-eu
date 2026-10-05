import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { SellerError } from "../sellers/errors";
import { exact } from "./model";
import { authorizeAftercareOperator } from "./operators.server";
export async function recoverOperatorDecision(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  if (
    !object(raw) ||
    typeof raw.actorKey !== "string" ||
    raw.actorKey !== libraryActorKey(identity) ||
    !validId(raw.resourceId) ||
    !validId(raw.requestId) ||
    (raw.kind !== "case" && raw.kind !== "feedback")
  )
    throw new SellerError("INVALID_INPUT");
  exact(raw, ["actorKey", "resourceId", "requestId", "kind"]);
  const command = {
    resourceId: raw.resourceId,
    requestId: raw.requestId,
    kind: raw.kind,
  };
  return inTransaction(database, async (tx) => {
    const access = await authorizeAftercareOperator(
      tx,
      identity,
      command.kind === "case" ? "cases.decide" : "feedback.moderate",
    );
    const result =
      command.kind === "case"
        ? (
            await tx.client.query<{ revision: number }>(
              "SELECT r.accepted_revision AS revision FROM treido.order_aftercare_receipts r JOIN treido.order_cases c ON c.id=r.case_id AND c.order_id=r.order_id JOIN treido.order_service_policies p ON p.id=c.policy_id WHERE r.actor_id=$1 AND r.request_id=$2 AND c.id=$3 AND p.environment=$4 AND p.application_id=$5 AND r.action IN ($6,$7,$8)",
              [
                access.user.id,
                command.requestId,
                command.resourceId,
                access.environment,
                access.applicationId,
                "operator_recommendation",
                "operator_information",
                "operator_no_decision",
              ],
            )
          ).rows[0]
        : (
            await tx.client.query<{ revision: number }>(
              "SELECT r.accepted_revision AS revision FROM treido.order_feedback_receipts r JOIN treido.order_purchase_feedback f ON f.id=r.feedback_id AND f.order_id=r.order_id JOIN treido.order_feedback_policies p ON p.id=f.policy_id WHERE r.actor_id=$1 AND r.request_id=$2 AND f.id=$3 AND p.environment=$4 AND p.application_id=$5 AND r.action IN ($6,$7)",
              [
                access.user.id,
                command.requestId,
                command.resourceId,
                access.environment,
                access.applicationId,
                "publish",
                "hide",
              ],
            )
          ).rows[0];
    if (!result) throw new SellerError("NOT_FOUND");
    return {
      resourceId: command.resourceId,
      requestId: command.requestId,
      revision: result.revision,
    };
  });
}
