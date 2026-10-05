import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { EffectContext } from "../../server/jobs/execution.server";
import type { SellerJobRow } from "../../server/jobs/outbox.server";
import { JobError } from "../../server/jobs/model";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { assertDelegableTeamAccess } from "./policy.server";
import type { TeamAccess } from "./model";
import type {
  InvitationMailBinding,
  InvitationMailPayload,
  MailState,
} from "./mail-model";

export type InvitationDeliveryRow = {
  id: string;
  sellerId: string;
  invitationId: string;
  actorId: string;
  sellerName: string;
  state: MailState;
  providerId: string | null;
  payload: InvitationMailPayload | null;
  firstAttempt: Date | null;
  binding: InvitationMailBinding | null;
  providerKey: string | null;
  invitationRevision: number;
  revision: number;
  createdBy: string;
  recipient: string;
  role: TeamAccess["role"];
  grants: TeamAccess["grants"];
  language: "bg" | "en";
  status: string;
  expiresAt: Date;
  now: Date;
};
export const mailColumns = `d.id,d.seller_id AS "sellerId",d.invitation_id AS "invitationId",d.actor_id AS "actorId",d.seller_name AS "sellerName",d.state,d.provider_id AS "providerId",d.request_payload AS payload,d.first_attempt_at AS "firstAttempt",d.mail_binding AS binding,d.provider_key AS "providerKey",d.invitation_revision AS "invitationRevision",i.revision,i.created_by AS "createdBy",i.recipient,i.role,i.grants,i.language,i.status,i.expires_at AS "expiresAt",clock_timestamp() AS now`;

/** Durable offline work uses the existing job issuer authority, never a bearer invitation session. */
export async function authorizeInvitationMailJob(
  tx: SellerTransaction,
  context: SellerJobRow,
  executionToken?: string,
): Promise<InvitationDeliveryRow> {
  if (
    context.kind !== "team.invitation" ||
    context.authority !== "member" ||
    !context.actorId ||
    (executionToken !== undefined && !validId(executionToken)) ||
    context.operationKey !== context.resourceId
  )
    throw new JobError("FORBIDDEN");
  const initial = (
    await tx.client.query<InvitationDeliveryRow>(
      `SELECT ${mailColumns} FROM treido.invitation_deliveries d JOIN treido.seller_invitations i ON i.id=d.invitation_id AND i.seller_id=d.seller_id WHERE d.id=$1 AND d.seller_id=$2 AND d.actor_id=$3`,
      [context.resourceId, context.sellerId, context.actorId],
    )
  ).rows[0];
  if (!initial) throw new JobError("FORBIDDEN");
  // Match acceptance's humans -> seller -> memberships -> invitation ordering.
  const humans = (
    await tx.client.query<{ id: string; subject: string; status: string }>(
      `SELECT id,clerk_subject AS subject,status FROM treido.users WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE`,
      [[initial.createdBy, initial.actorId]],
    )
  ).rows;
  for (const id of [...new Set([initial.createdBy, initial.actorId])]) {
    const human = humans.find((h) => h.id === id);
    if (!human || human.status !== "active") throw new SellerError("FORBIDDEN");
    const current = await authorizeSeller(
      tx,
      { subject: human.subject },
      context.sellerId,
      "team.manage",
    );
    if (current.seller.kind !== "business") throw new SellerError("FORBIDDEN");
    assertDelegableTeamAccess(current.authority, {
      role: initial.role,
      grants: initial.grants,
    });
  }
  const row = (
    await tx.client.query<InvitationDeliveryRow>(
      `SELECT ${mailColumns} FROM treido.invitation_deliveries d JOIN treido.seller_invitations i ON i.id=d.invitation_id AND i.seller_id=d.seller_id WHERE d.id=$1 AND d.seller_id=$2 AND d.actor_id=$3 FOR UPDATE OF i,d`,
      [context.resourceId, context.sellerId, context.actorId],
    )
  ).rows[0];
  if (
    !row ||
    row.status !== "pending" ||
    row.expiresAt <= row.now ||
    row.revision !== row.invitationRevision ||
    row.state === "cancelled"
  )
    throw new SellerError("CONFLICT");
  // Fence against forged/stale contexts even when called directly, outside executeJob.
  const live = await tx.client.query(
    `SELECT j.id FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id AND e.kind=j.kind AND e.operation_key=j.operation_key WHERE j.id=$1 AND j.kind='team.invitation' AND j.seller_id=$2 AND j.actor_id=$3 AND j.authority='member' AND j.resource_id=$4 AND j.operation_key=$4 AND j.generation=$5 ${executionToken ? "AND j.state IN ('pending','accepted') AND e.state='running' AND e.execution_token=$6 AND e.execution_until>clock_timestamp() FOR SHARE OF j,e" : ""}`,
    [
      context.id,
      context.sellerId,
      context.actorId,
      context.resourceId,
      context.generation,
      ...(executionToken ? [executionToken] : []),
    ],
  );
  if (live.rowCount !== 1) throw new JobError("STALE_LEASE");
  return row;
}
export function lockInvitationMail(
  tx: SellerTransaction,
  context: EffectContext,
) {
  if (!validId(context.executionToken)) throw new JobError("STALE_LEASE");
  return authorizeInvitationMailJob(tx, context, context.executionToken);
}
export function sameMailBinding(
  left: InvitationMailBinding | null,
  right: InvitationMailBinding,
) {
  return left !== null && inputHash(left) === inputHash(right);
}
/** A factual acknowledgement must survive loss of the executor completion/authority.
 * It grants no membership and cannot rewrite the frozen effect identity. */
export async function recordMailAcknowledgement(
  tx: SellerTransaction,
  row: InvitationDeliveryRow,
  providerId: string,
) {
  const written = await tx.client.query(
    `UPDATE treido.invitation_deliveries SET provider_id=$3,state=CASE WHEN state IN ('pending','unavailable','uncertain') THEN 'submitted' ELSE state END,submitted_at=COALESCE(submitted_at,clock_timestamp()),observed_at=clock_timestamp() WHERE id=$1 AND seller_id=$2 AND provider_key=$4 AND request_payload=$5::jsonb AND (provider_id IS NULL OR provider_id=$3) RETURNING id`,
    [
      row.id,
      row.sellerId,
      providerId,
      row.providerKey,
      JSON.stringify(row.payload),
    ],
  );
  if (written.rowCount !== 1) throw new JobError("CONFLICT");
}
