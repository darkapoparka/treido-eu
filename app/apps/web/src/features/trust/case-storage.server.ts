import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import type {
  CaseCommand,
  CaseDecision,
  CaseReceipt,
  TrustCaseKind,
} from "./case-model";

/** Absent additive storage is explicitly unavailable. Partial installation and
 * database/permission failures fail closed rather than inventing empty success. */
export async function caseStorageReady(
  tx: SellerTransaction,
): Promise<boolean> {
  const row = (
    await tx.client.query<{
      decisions: string | null;
      messages: string | null;
    }>(
      "SELECT to_regclass('treido.trust_case_decisions')::text AS decisions,to_regclass('treido.message_moderation_actions')::text AS messages",
    )
  ).rows[0];
  if (!row.decisions && !row.messages) return false;
  if (!row.decisions || !row.messages) throw new SellerError("NOT_AVAILABLE");
  return true;
}
// Fixed safe projection. No actor, reporter, internal evidence or other appeals.
export const caseDecisionColumns = `d.id,d.kind,d.case_id AS "caseId",d.resource_id AS "resourceId",
 d.accepted_revision AS revision,d.resource_revision AS "resourceRevision",d.outcome,d.reason,
 coalesce(d.message_action_id,d.listing_action_id) AS "actionId",d.resulting_state AS state,
 to_char(d.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at`;
export async function readCaseDecision(
  tx: SellerTransaction,
  kind: TrustCaseKind,
  id: string,
) {
  return (
    (
      await tx.client.query<CaseDecision>(
        `SELECT ${caseDecisionColumns} FROM treido.trust_case_decisions d WHERE d.kind=$1 AND d.case_id=$2`,
        [kind, id],
      )
    ).rows[0] ?? null
  );
}
export async function readCaseReceipt(
  tx: SellerTransaction,
  actorId: string,
  command: CaseCommand,
): Promise<CaseReceipt | null> {
  const row = (
    await tx.client.query<CaseDecision & { hash: string }>(
      `SELECT ${caseDecisionColumns},d.input_hash AS hash FROM treido.trust_case_decisions d WHERE d.actor_id=$1 AND d.request_id=$2`,
      [actorId, command.requestId],
    )
  ).rows[0];
  if (!row) return null;
  if (row.hash !== inputHash(command)) throw new SellerError("CONFLICT");
  return {
    command,
    decision: {
      id: row.id,
      kind: row.kind,
      caseId: row.caseId,
      resourceId: row.resourceId,
      revision: row.revision,
      resourceRevision: row.resourceRevision,
      outcome: row.outcome,
      reason: row.reason,
      actionId: row.actionId,
      state: row.state,
      at: row.at,
    },
  };
}
export async function readMessageModeration(
  tx: SellerTransaction,
  messageId: string,
  ready: boolean,
) {
  if (!ready) return { revision: 1, state: "visible" as const };
  return (
    (
      await tx.client.query<{ revision: number; state: "visible" | "hidden" }>(
        "SELECT accepted_revision AS revision,state FROM treido.message_moderation_actions WHERE message_id=$1 ORDER BY accepted_revision DESC LIMIT 1",
        [messageId],
      )
    ).rows[0] ?? { revision: 1, state: "visible" as const }
  );
}
/** Fixed aliases from source only; never accept request SQL. */
export function messageHiddenSql(
  ready: boolean,
  alias: "m" | "last_message" = "m",
) {
  return ready
    ? `coalesce((SELECT ma.state='hidden' FROM treido.message_moderation_actions ma WHERE ma.message_id=${alias}.id ORDER BY ma.accepted_revision DESC LIMIT 1),false)`
    : "false";
}
export function messageReasonSql(ready: boolean) {
  return ready
    ? `(SELECT ma.reason FROM treido.message_moderation_actions ma WHERE ma.message_id=m.id ORDER BY ma.accepted_revision DESC LIMIT 1)`
    : "NULL::text";
}
