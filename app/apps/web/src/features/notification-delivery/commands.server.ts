import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { readNotificationRecipient } from "./recipient.server";
import {
  notificationMailConfig,
  notificationRecipientAllowed,
} from "./config.server";
import {
  parseNotificationPreference,
  type NotificationPreferenceAcknowledgement,
} from "./model";
import {
  requireNotificationStorage,
  preferenceColumns,
  type PreferenceRow,
} from "./preferences.server";
type Receipt = {
  hash: string;
  result: {
    revision: number;
    settings: NotificationPreferenceAcknowledgement["settings"];
  };
};
async function readReceipt(
  tx: SellerTransaction,
  userId: string,
  requestId: string,
) {
  return (
    await tx.client.query<Receipt>(
      `SELECT input_hash AS hash,result FROM treido.notification_email_receipts WHERE user_id=$1 AND request_id=$2`,
      [userId, requestId],
    )
  ).rows[0];
}
export async function changeNotificationPreferences(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<NotificationPreferenceAcknowledgement> {
  const command = parseNotificationPreference(raw),
    actorKey = libraryActorKey(identity);
  if (command.actorKey !== actorKey) throw new SellerError("FORBIDDEN");
  const hash = inputHash(command);
  const acknowledge = (prior: Receipt) => {
    if (prior.hash !== hash) throw new SellerError("CONFLICT");
    return {
      ...prior.result,
      actorKey,
      actorSubject: identity.subject,
      requestId: command.requestId,
    };
  };
  const observed = await inTransaction(database, async (tx) => {
    await requireNotificationStorage(tx);
    const user = await authorizeHuman(tx, identity, false);
    const prior = await readReceipt(tx, user.id, command.requestId);
    if (prior) return { receipt: acknowledge(prior), increases: false };
    const previous = (
      await tx.client.query<PreferenceRow>(
        `SELECT ${preferenceColumns} FROM treido.notification_email_preferences p WHERE p.user_id=$1`,
        [user.id],
      )
    ).rows[0];
    if ((previous?.revision ?? 0) !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    return {
      receipt: null,
      increases:
        (command.savedSearchEmail && !previous?.savedSearchEmail) ||
        (command.messageEmail && !previous?.messageEmail),
    };
  });
  // Exact saved receipts remain recoverable during later provider outages.
  if (observed.receipt) return observed.receipt;
  // Per-channel disabling remains available while the other channel stays enabled.
  if (observed.increases) {
    const config = notificationMailConfig();
    if (!config) throw new SellerError("NOT_AVAILABLE");
    const recipient = await readNotificationRecipient(identity.subject);
    if (!recipient || !notificationRecipientAllowed(config, recipient))
      throw new SellerError("NOT_AVAILABLE");
  }
  return inTransaction(database, async (tx) => {
    await requireNotificationStorage(tx);
    const user = await authorizeHuman(tx, identity, false);
    // Serialize first-save, revisions and retry receipts without a provider call under locks.
    await tx.client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
      ["notification-email-preferences:" + user.id],
    );
    const prior = await readReceipt(tx, user.id, command.requestId);
    if (prior) return acknowledge(prior);
    const previous = (
      await tx.client.query<PreferenceRow>(
        `SELECT ${preferenceColumns} FROM treido.notification_email_preferences p WHERE p.user_id=$1 FOR UPDATE`,
        [user.id],
      )
    ).rows[0];
    if ((previous?.revision ?? 0) !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    const row = (
      await tx.client.query<{ revision: number }>(
        `INSERT INTO treido.notification_email_preferences(user_id,revision,consent_generation,saved_search_email,message_email,language,consent_version,consent_at)
      VALUES($1,1,1,$2,$3,$4,$5,CASE WHEN $2 OR $3 THEN clock_timestamp() ELSE NULL END)
      ON CONFLICT(user_id) DO UPDATE SET revision=notification_email_preferences.revision+1,consent_generation=notification_email_preferences.consent_generation+1,saved_search_email=$2,message_email=$3,language=$4,consent_version=$5,consent_at=CASE WHEN $2 OR $3 THEN clock_timestamp() ELSE NULL END,updated_at=clock_timestamp() RETURNING revision`,
        [
          user.id,
          command.savedSearchEmail,
          command.messageEmail,
          command.language,
          command.consentVersion,
        ],
      )
    ).rows[0];
    // Pending sends from an older choice cannot be replayed after opt-out/reconfirmation.
    await tx.client.query(
      `UPDATE treido.notification_email_deliveries SET state='cancelled',updated_at=clock_timestamp() WHERE user_id=$1 AND provider_id IS NULL AND state IN ('pending','unavailable','uncertain')`,
      [user.id],
    );
    const result = {
      revision: row.revision,
      settings: {
        savedSearchEmail: command.savedSearchEmail,
        messageEmail: command.messageEmail,
      },
    };
    await tx.client.query(
      `INSERT INTO treido.notification_email_receipts(user_id,request_id,input_hash,result) VALUES($1,$2,$3,$4::jsonb)`,
      [user.id, command.requestId, hash, JSON.stringify(result)],
    );
    return {
      ...result,
      actorKey,
      actorSubject: identity.subject,
      requestId: command.requestId,
    };
  });
}
