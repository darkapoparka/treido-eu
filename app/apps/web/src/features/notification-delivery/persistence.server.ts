import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { JobError } from "../../server/jobs/model";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import {
  notificationSourceLink,
  type NotificationSource,
} from "./source.server";
import {
  preferenceColumns,
  requireNotificationStorage,
  type PreferenceRow,
} from "./preferences.server";
import type { NotificationJobRow, NotificationMailState } from "./model";
import type { NotificationMailBinding } from "./config.server";
import type { NotificationMailPayload } from "./mail-model";
export type NotificationDeliveryRow = NotificationSource & {
  id: string;
  generation: number;
  state: NotificationMailState;
  providerId: string | null;
  firstAttempt: Date | null;
  payload: NotificationMailPayload | null;
  binding: NotificationMailBinding | null;
  providerKey: string | null;
  now: Date;
};
export const deliveryColumns = `d.id,d.user_id AS "userId",d.kind,d.source_id AS "sourceId",d.source_revision AS "sourceRevision",d.seller_id AS "sellerId",d.consent_generation AS generation,d.language,d.state,d.provider_id AS "providerId",d.first_attempt_at AS "firstAttempt",d.request_payload AS payload,d.mail_binding AS binding,d.provider_key AS "providerKey",clock_timestamp() AS now`;
/** Locks: active human, current source authority, preference, delivery, then job/effect. */
export async function authorizeNotificationJob(
  tx: SellerTransaction,
  job: NotificationJobRow,
  executionToken?: string,
) {
  if (
    job.kind !== "buyer.notification-email" ||
    job.authority !== "notification" ||
    job.sellerId !== null ||
    job.actorId !== null ||
    !validId(job.buyerId) ||
    !validId(job.resourceId) ||
    job.operationKey !== job.resourceId ||
    (executionToken !== undefined && !validId(executionToken))
  )
    throw new JobError("FORBIDDEN");
  await requireNotificationStorage(tx);
  const human = (
    await tx.client.query<{ subject: string }>(
      `SELECT clerk_subject AS subject FROM treido.users WHERE id=$1`,
      [job.buyerId],
    )
  ).rows[0];
  if (!human) throw new SellerError("FORBIDDEN");
  const user = await authorizeHuman(tx, { subject: human.subject }, false);
  const initial = (
    await tx.client.query<NotificationDeliveryRow>(
      `SELECT ${deliveryColumns} FROM treido.notification_email_deliveries d WHERE d.id=$1 AND d.user_id=$2`,
      [job.resourceId, user.id],
    )
  ).rows[0];
  if (!initial) throw new SellerError("FORBIDDEN");
  const link = await notificationSourceLink(tx, initial, human.subject);
  const preference = (
    await tx.client.query<PreferenceRow>(
      `SELECT ${preferenceColumns} FROM treido.notification_email_preferences p WHERE p.user_id=$1 FOR SHARE`,
      [user.id],
    )
  ).rows[0];
  if (
    !preference ||
    preference.generation !== initial.generation ||
    !preference.consentAt ||
    !(initial.kind === "message"
      ? preference.messageEmail
      : preference.savedSearchEmail)
  )
    throw new SellerError("FORBIDDEN");
  const row = (
    await tx.client.query<NotificationDeliveryRow>(
      `SELECT ${deliveryColumns} FROM treido.notification_email_deliveries d WHERE d.id=$1 AND d.user_id=$2 FOR UPDATE`,
      [initial.id, user.id],
    )
  ).rows[0];
  if (
    !row ||
    row.state === "cancelled" ||
    row.generation !== preference.generation
  )
    throw new SellerError("FORBIDDEN");
  const live = await tx.client.query(
    `SELECT j.id FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id AND e.kind=j.kind AND e.operation_key=j.operation_key
    WHERE j.id=$1 AND j.kind='buyer.notification-email' AND j.authority='notification' AND j.seller_id IS NULL AND j.actor_id IS NULL AND j.buyer_id=$2 AND j.resource_id=$3 AND j.operation_key=$3 AND j.generation=$4
    ${executionToken ? "AND j.state IN ('pending','accepted') AND e.state='running' AND e.execution_token=$5 AND e.execution_until>clock_timestamp() FOR SHARE OF j,e" : ""}`,
    [
      job.id,
      user.id,
      row.id,
      job.generation,
      ...(executionToken ? [executionToken] : []),
    ],
  );
  if (live.rowCount !== 1) throw new JobError("STALE_LEASE");
  return { row, subject: human.subject, link };
}
