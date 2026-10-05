import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type {
  EffectContext,
  EffectResult,
} from "../../server/jobs/execution.server";
import { JobError } from "../../server/jobs/model";
import { SellerError } from "../sellers/errors";
import { jobColumns, type SellerJobRow } from "../../server/jobs/outbox.server";
import {
  lockInvitationMail,
  recordMailAcknowledgement,
  sameMailBinding,
  type InvitationDeliveryRow,
} from "./mail-persistence.server";
import {
  canReplayMail,
  invitationMailKey,
  invitationMailPayload,
  mailRecipientAllowed,
  publicMailBinding,
  type InvitationMailConfig,
} from "./mail-model";
import {
  createResendInvitationProvider,
  InvitationMailProviderError,
  type InvitationMailProvider,
} from "./mail-provider.server";

export function createInvitationMailHandler(
  database: SellerDatabase,
  config: InvitationMailConfig | null,
  provider?: InvitationMailProvider,
) {
  return async (context: EffectContext): Promise<EffectResult> => {
    let row = await inTransaction(database, (tx) =>
      lockInvitationMail(tx, context),
    );
    if (row.state === "failed" && !row.providerId)
      return completion(row, context);
    if (!config) {
      await markUnavailable(row);
      throw new JobError("NOT_AVAILABLE");
    }
    const binding = publicMailBinding(config);
    if (
      !mailRecipientAllowed(binding, row.recipient) ||
      ((row.firstAttempt || row.providerId) &&
        !sameMailBinding(row.binding, binding))
    ) {
      await markUnavailable(row);
      throw new JobError("NOT_AVAILABLE");
    }
    if (row.providerId) return completion(row, context);
    if (!canReplayMail(row.firstAttempt, row.now)) {
      // Persist uncertainty; never resend an old unknown effect beyond dedupe retention.
      await database.pool.query(
        `UPDATE treido.invitation_deliveries SET state='uncertain' WHERE id=$1 AND provider_id IS NULL AND first_attempt_at IS NOT NULL`,
        [row.id],
      );
      throw new JobError("NOT_AVAILABLE");
    }
    const transport = provider ?? createResendInvitationProvider(config);
    try {
      await transport.verifySender();
    } catch {
      await markUnavailable(row);
      throw new JobError("NOT_AVAILABLE");
    }
    // Current authority/revision/expiry and live lease rechecked immediately before POST.
    row = await inTransaction(database, async (tx) => {
      const current = await lockInvitationMail(tx, context);
      if (current.providerId) return current;
      if (
        !canReplayMail(current.firstAttempt, current.now) ||
        (current.firstAttempt &&
          (!sameMailBinding(current.binding, binding) ||
            !current.payload ||
            current.providerKey !== invitationMailKey(binding, current.id)))
      )
        throw new JobError("NOT_AVAILABLE");
      const payload = current.firstAttempt
        ? current.payload!
        : invitationMailPayload(
            binding,
            {
              id: current.invitationId,
              recipient: current.recipient,
              language: current.language,
              sellerName: current.sellerName,
              expiresAt: current.expiresAt,
            },
            current.id,
          );
      const key = invitationMailKey(binding, current.id);
      await tx.client.query(
        `UPDATE treido.invitation_deliveries SET first_attempt_at=COALESCE(first_attempt_at,clock_timestamp()),request_payload=$2::jsonb,mail_binding=$3::jsonb,provider_key=$4,state='uncertain' WHERE id=$1 AND provider_id IS NULL`,
        [current.id, JSON.stringify(payload), JSON.stringify(binding), key],
      );
      return { ...current, payload, binding, providerKey: key };
    });
    if (row.providerId) return completion(row, context);
    let providerId: string;
    try {
      providerId = await transport.send(row.payload!, row.providerKey!);
    } catch (error) {
      if (
        error instanceof InvitationMailProviderError &&
        error.outcome === "rejected"
      )
        await database.pool.query(
          `UPDATE treido.invitation_deliveries SET state='failed',observed_at=clock_timestamp() WHERE id=$1 AND provider_id IS NULL AND state='uncertain'`,
          [row.id],
        );
      // A lost acknowledgement leaves the pre-POST uncertain record intact.
      throw new JobError("NOT_AVAILABLE");
    }
    await inTransaction(database, (tx) =>
      recordMailAcknowledgement(tx, row, providerId),
    );
    return completion({ ...row, providerId }, context);
  };
  async function markUnavailable(row: InvitationDeliveryRow) {
    await database.pool.query(
      `UPDATE treido.invitation_deliveries SET state='unavailable' WHERE id=$1 AND provider_id IS NULL AND first_attempt_at IS NULL AND state IN ('pending','unavailable')`,
      [row.id],
    );
  }
}
function completion(
  row: InvitationDeliveryRow,
  context: EffectContext,
): EffectResult {
  return {
    resultId: row.id,
    providerObjectId: row.providerId ?? undefined,
    lock: async (tx) => {
      await lockInvitationMail(tx, context);
    },
    apply: async (tx) => {
      await lockInvitationMail(tx, context);
    },
  };
}

/** Bounded read-only provider reconciliation of known IDs. No sends or new jobs.
 * Unknown effects stay uncertain; their same-intent replay is controlled by the handler. */
export async function maintainInvitationMail(
  database: SellerDatabase,
  config: InvitationMailConfig | null,
  provider?: InvitationMailProvider,
) {
  if (!config) return { available: false, checked: 0 };
  const transport = provider ?? createResendInvitationProvider(config);
  const binding = publicMailBinding(config);
  // Scope before bounding the page: unrelated frozen bindings must never consume
  // this application's reconciliation slots or be modified by its credentials.
  const rows = (
    await database.pool.query<{
      id: string;
      sellerId: string;
      providerId: string;
      payload: InvitationDeliveryRow["payload"];
      binding: InvitationDeliveryRow["binding"];
    }>(
      `SELECT id,seller_id AS "sellerId",provider_id AS "providerId",request_payload AS payload,mail_binding AS binding FROM treido.invitation_deliveries WHERE provider_id IS NOT NULL AND mail_binding=$1::jsonb AND request_payload IS NOT NULL AND state IN ('submitted','sent','delivered') AND (last_checked_at IS NULL OR last_checked_at<clock_timestamp()-interval '10 minutes') AND submitted_at>clock_timestamp()-interval '30 days' ORDER BY last_checked_at NULLS FIRST,id LIMIT 5`,
      [JSON.stringify(binding)],
    )
  ).rows;
  let checked = 0;
  for (const row of rows) {
    if (!row.payload || !sameMailBinding(row.binding, binding)) continue;
    await database.pool.query(
      `UPDATE treido.invitation_deliveries SET last_checked_at=clock_timestamp() WHERE id=$1`,
      [row.id],
    );
    try {
      const state = await transport.retrieve(row.providerId, row.payload);
      if (!state) continue;
      await database.pool.query(
        `UPDATE treido.invitation_deliveries SET state=$3,observed_at=clock_timestamp() WHERE id=$1 AND seller_id=$2 AND provider_id=$4 AND state IN ('submitted','sent','delivered') AND NOT(state='sent' AND $3='submitted') AND NOT(state='delivered' AND $3 IN ('submitted','sent'))`,
        [row.id, row.sellerId, state, row.providerId],
      );
      checked++;
    } catch {
      /* A status lookup failure does not erase the known acknowledgement. */
    }
  }
  return { available: true, checked };
}

/** The current initiating member may retry the same effect; no fabricated service identity. */
export async function retryInvitationMail(
  tx: import("../../server/db/database").SellerTransaction,
  sellerId: string,
  invitationId: string,
  actorId: string,
) {
  const delivery = (
    await tx.client.query<{
      id: string;
      state: string;
      providerId: string | null;
      actorId: string;
      replay: boolean;
    }>(
      `SELECT id,state,provider_id AS "providerId",actor_id AS "actorId",(first_attempt_at IS NULL OR first_attempt_at>clock_timestamp()-interval '23 hours') AS replay FROM treido.invitation_deliveries WHERE invitation_id=$1 AND seller_id=$2 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`,
      [invitationId, sellerId],
    )
  ).rows[0];
  if (
    !delivery ||
    delivery.actorId !== actorId ||
    delivery.providerId ||
    !delivery.replay ||
    !["pending", "unavailable", "uncertain"].includes(delivery.state)
  )
    throw new SellerError("CONFLICT");
  const recent = await tx.client.query(
    `SELECT 1 FROM treido.team_command_receipts WHERE seller_id=$1 AND result_id=$2 AND created_at>clock_timestamp()-interval '1 minute' LIMIT 1`,
    [sellerId, delivery.id],
  );
  if (recent.rowCount) throw new SellerError("CONFLICT");
  const job = (
    await tx.client.query<SellerJobRow>(
      `SELECT ${jobColumns} FROM treido.outbox_jobs WHERE kind='team.invitation' AND seller_id=$1 AND resource_id=$2 AND operation_key=$2 AND actor_id=$3 AND authority='member' FOR UPDATE`,
      [sellerId, delivery.id, actorId],
    )
  ).rows[0];
  if (!job || !["pending", "accepted", "dead"].includes(job.state))
    throw new SellerError("CONFLICT");
  const effect = await tx.client.query(
    `SELECT job_id FROM treido.job_effects WHERE job_id=$1 AND state IN ('pending','running') AND (execution_until IS NULL OR execution_until<clock_timestamp()) FOR UPDATE`,
    [job.id],
  );
  if (effect.rowCount !== 1) throw new SellerError("CONFLICT");
  await tx.client.query(
    `UPDATE treido.outbox_jobs SET state='pending',generation=generation+1,attempts=0,available_at=clock_timestamp(),progress_at=clock_timestamp(),dispatch_token=NULL,dispatch_until=NULL,executor_event_id=NULL,accepted_at=NULL,last_error=NULL WHERE id=$1`,
    [job.id],
  );
  await tx.client.query(
    `UPDATE treido.job_effects SET state='pending',execution_token=NULL,execution_until=NULL WHERE job_id=$1`,
    [job.id],
  );
  return delivery.id;
}
