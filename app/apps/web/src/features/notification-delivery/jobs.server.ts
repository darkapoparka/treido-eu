import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { EffectResult } from "../../server/jobs/execution.server";
import { JobError } from "../../server/jobs/model";
import { inputHash } from "../sellers/persistence.server";
import {
  authorizeNotificationJob,
  deliveryColumns,
  type NotificationDeliveryRow,
} from "./persistence.server";
import {
  notificationMailConfig,
  notificationMailBinding,
  notificationRecipientAllowed,
  type NotificationMailConfig,
} from "./config.server";
import { readNotificationRecipient } from "./recipient.server";
import {
  canReplayMail,
  notificationMailKey,
  notificationMailPayload,
} from "./mail-model";
import {
  createNotificationMailProvider,
  NotificationMailProviderError,
  type NotificationMailProvider,
} from "./mail-provider.server";
import type { NotificationEffectContext, NotificationMailState } from "./model";

export type NotificationExecutionOptions = {
  config?: NotificationMailConfig | null;
  provider?: NotificationMailProvider;
  recipient?: (subject: string) => Promise<string | null>;
};
export async function processNotificationEmail(
  database: SellerDatabase,
  job: NotificationEffectContext,
  options: NotificationExecutionOptions = {},
): Promise<EffectResult> {
  const lock = (tx: SellerTransaction) =>
    authorizeNotificationJob(tx, job, job.executionToken);
  let accepted = await inTransaction(database, lock),
    row = accepted.row;
  // Recover a factual original receipt without attempting any new provider IO.
  if (row.providerId || ["failed", "bounced", "complained"].includes(row.state))
    return completion(row, lock);
  const config =
    options.config === undefined ? notificationMailConfig() : options.config;
  if (!config) {
    await database.pool.query(
      `UPDATE treido.notification_email_deliveries SET state='unavailable',updated_at=clock_timestamp() WHERE id=$1 AND user_id=$2 AND first_attempt_at IS NULL AND provider_id IS NULL AND state IN ('pending','unavailable')`,
      [row.id, row.userId],
    );
    throw new JobError("NOT_AVAILABLE");
  }
  const binding = notificationMailBinding(config),
    provider = options.provider ?? createNotificationMailProvider(config);
  if (row.firstAttempt && inputHash(row.binding) !== inputHash(binding))
    throw new JobError("NOT_AVAILABLE");
  if (!canReplayMail(row.firstAttempt, row.now))
    throw new JobError("NOT_AVAILABLE");
  await provider.verifySender();
  const recipient = await (options.recipient ?? readNotificationRecipient)(
    accepted.subject,
  );
  if (!recipient || !notificationRecipientAllowed(binding, recipient))
    throw new JobError("NOT_AVAILABLE");
  accepted = await inTransaction(database, async (tx) => {
    const current = await lock(tx),
      live = current.row;
    if (live.providerId) return current;
    if (
      !canReplayMail(live.firstAttempt, live.now) ||
      (live.firstAttempt &&
        (inputHash(live.binding) !== inputHash(binding) ||
          live.providerKey !== notificationMailKey(binding, live.id) ||
          live.payload?.to.length !== 1 ||
          live.payload.to[0] !== recipient))
    )
      throw new JobError("NOT_AVAILABLE");
    const payload = live.firstAttempt
      ? live.payload!
      : notificationMailPayload(
          binding,
          recipient,
          current.link,
          live.id,
          live.language,
        );
    const key = notificationMailKey(binding, live.id);
    await tx.client.query(
      `UPDATE treido.notification_email_deliveries SET first_attempt_at=COALESCE(first_attempt_at,clock_timestamp()),request_payload=$3::jsonb,mail_binding=$4::jsonb,provider_key=$5,state='uncertain',retry_at=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp() WHERE id=$1 AND user_id=$2 AND provider_id IS NULL`,
      [
        live.id,
        live.userId,
        JSON.stringify(payload),
        JSON.stringify(binding),
        key,
      ],
    );
    return { ...current, row: { ...live, payload, binding, providerKey: key } };
  });
  row = accepted.row;
  if (row.providerId) return completion(row, lock);
  let providerId: string;
  try {
    providerId = await provider.send(row.payload!, row.providerKey!);
  } catch (error) {
    if (
      error instanceof NotificationMailProviderError &&
      error.outcome === "rejected"
    )
      await database.pool.query(
        `UPDATE treido.notification_email_deliveries SET state='failed',updated_at=clock_timestamp() WHERE id=$1 AND user_id=$2 AND state='uncertain' AND provider_id IS NULL`,
        [row.id, row.userId],
      );
    throw new JobError("NOT_AVAILABLE");
  }
  // Acknowledgement is a factual effect receipt even if opt-out/lease loss raced the POST.
  // It never restores preference, access or permission to send another email.
  const acknowledged = await database.pool.query(
    `UPDATE treido.notification_email_deliveries SET provider_id=$3,provider_state=COALESCE(provider_state,'submitted'),state=CASE WHEN state='cancelled' OR provider_state IS NOT NULL THEN state ELSE 'submitted' END,submitted_at=COALESCE(submitted_at,clock_timestamp()),updated_at=clock_timestamp()
    WHERE id=$1 AND user_id=$2 AND provider_key=$4 AND request_payload=$5::jsonb AND mail_binding=$6::jsonb AND (provider_id IS NULL OR provider_id=$3) RETURNING id`,
    [
      row.id,
      row.userId,
      providerId,
      row.providerKey,
      JSON.stringify(row.payload),
      JSON.stringify(row.binding),
    ],
  );
  if (acknowledged.rowCount !== 1) throw new JobError("CONFLICT");
  return completion({ ...row, providerId }, lock);
}
function completion(
  row: NotificationDeliveryRow,
  lock: (tx: SellerTransaction) => Promise<unknown>,
): EffectResult {
  return {
    resultId: row.id,
    ...(row.providerId ? { providerObjectId: row.providerId } : {}),
    lock: async (tx) => {
      await lock(tx);
    },
    apply: async (tx) => {
      await lock(tx);
    },
  };
}

/** Reconcile actual known IDs only. Never POST again after an acknowledgement. */
export async function maintainNotificationEmails(
  database: SellerDatabase,
  options: Pick<NotificationExecutionOptions, "config" | "provider"> = {},
) {
  const config =
    options.config === undefined ? notificationMailConfig() : options.config;
  if (!config) return { available: false, checked: 0 };
  const binding = notificationMailBinding(config),
    provider = options.provider ?? createNotificationMailProvider(config);
  const rows = (
    await database.pool.query<NotificationDeliveryRow>(
      `SELECT ${deliveryColumns} FROM treido.notification_email_deliveries d WHERE d.provider_id IS NOT NULL AND d.mail_binding=$1::jsonb AND d.request_payload IS NOT NULL AND d.state IN ('submitted','sent','delivered','cancelled') AND d.submitted_at>clock_timestamp()-interval '30 days' AND (d.last_checked_at IS NULL OR d.last_checked_at<clock_timestamp()-interval '10 minutes') ORDER BY d.last_checked_at NULLS FIRST,d.id LIMIT 5`,
      [JSON.stringify(binding)],
    )
  ).rows;
  let checked = 0;
  for (const row of rows) {
    if (!row.providerId || !row.payload) continue;
    let observed: NotificationMailState | null;
    const recordAttempt = () =>
      database.pool.query(
        `UPDATE treido.notification_email_deliveries SET last_checked_at=clock_timestamp() WHERE id=$1 AND user_id=$2 AND provider_id=$3 AND mail_binding=$4::jsonb`,
        [row.id, row.userId, row.providerId, JSON.stringify(binding)],
      );
    try {
      observed = await provider.retrieve(row.providerId, row.payload);
    } catch {
      await recordAttempt();
      continue;
    }
    if (
      !observed ||
      ![
        "submitted",
        "sent",
        "delivered",
        "bounced",
        "failed",
        "complained",
      ].includes(observed)
    ) {
      await recordAttempt();
      continue;
    }
    await inTransaction(database, async (tx) => {
      // Match preference mutations' human -> preference -> delivery lock order.
      await tx.client.query(
        `SELECT id FROM treido.users WHERE id=$1 FOR SHARE`,
        [row.userId],
      );
      const preference = (
        await tx.client.query<{ generation: number }>(
          `SELECT consent_generation AS generation FROM treido.notification_email_preferences WHERE user_id=$1 FOR UPDATE`,
          [row.userId],
        )
      ).rows[0];
      const current = (
        await tx.client.query<{
          state: NotificationMailState;
          providerState: NotificationMailState | null;
        }>(
          `SELECT state,provider_state AS "providerState" FROM treido.notification_email_deliveries WHERE id=$1 AND user_id=$2 AND provider_id=$3 AND mail_binding=$4::jsonb FOR UPDATE`,
          [row.id, row.userId, row.providerId, JSON.stringify(binding)],
        )
      ).rows[0];
      // Accepted optional-data removal may have erased this private receipt
      // while the factual provider GET was in flight.
      if (!current) return;
      const terminal = ["bounced", "failed", "complained"].includes(
          current.providerState ?? "",
        ),
        next =
          terminal ||
          (current.providerState === "delivered" &&
            ["submitted", "sent"].includes(observed)) ||
          (current.providerState === "sent" && observed === "submitted")
            ? current.providerState!
            : observed;
      await tx.client.query(
        `UPDATE treido.notification_email_deliveries SET provider_state=$3,state=CASE WHEN state='cancelled' THEN state ELSE $3 END,last_checked_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1 AND user_id=$2`,
        [row.id, row.userId, next],
      );
      if (
        ["bounced", "complained"].includes(next) &&
        preference?.generation === row.generation
      ) {
        await tx.client.query(
          `UPDATE treido.notification_email_preferences SET saved_search_email=false,message_email=false,consent_at=NULL,revision=revision+1,consent_generation=consent_generation+1,updated_at=clock_timestamp() WHERE user_id=$1`,
          [row.userId],
        );
        await tx.client.query(
          `UPDATE treido.notification_email_deliveries SET state='cancelled',updated_at=clock_timestamp() WHERE user_id=$1 AND provider_id IS NULL AND state IN ('pending','unavailable','uncertain')`,
          [row.userId],
        );
      }
    });
    checked++;
  }
  return { available: true, checked };
}
