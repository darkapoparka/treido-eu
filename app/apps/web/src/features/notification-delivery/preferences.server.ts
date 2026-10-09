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
import { readNotificationRecipient } from "./recipient.server";
import {
  notificationMailConfig,
  notificationRecipientAllowed,
} from "./config.server";
import {
  notificationLanguage,
  type NotificationLanguage,
  type NotificationPreferenceView,
} from "./model";
export type PreferenceRow = {
  userId: string;
  revision: number;
  generation: number;
  savedSearchEmail: boolean;
  messageEmail: boolean;
  language: NotificationLanguage;
  consentAt: Date | null;
};
export const preferenceColumns = `p.user_id AS "userId",p.revision,p.consent_generation AS generation,p.saved_search_email AS "savedSearchEmail",p.message_email AS "messageEmail",p.language,p.consent_at AS "consentAt"`;
export async function notificationStorageReady(tx: {
  client: Pick<SellerTransaction["client"], "query">;
}) {
  return (
    (
      await tx.client.query<{ ready: boolean }>(
        `SELECT to_regclass('treido.notification_email_preferences') IS NOT NULL AND to_regclass('treido.notification_email_receipts') IS NOT NULL AND to_regclass('treido.notification_email_deliveries') IS NOT NULL AS ready`,
      )
    ).rows[0]?.ready === true
  );
}
export async function requireNotificationStorage(tx: SellerTransaction) {
  if (!(await notificationStorageReady(tx)))
    throw new SellerError("NOT_AVAILABLE");
}
export async function readNotificationPreferences(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  rawLanguage: unknown,
): Promise<NotificationPreferenceView> {
  const language = notificationLanguage(rawLanguage);
  // Authenticate before the provider read, then project the current account/settings.
  await inTransaction(database, async (tx) => {
    await requireNotificationStorage(tx);
    await authorizeHuman(tx, identity, false);
  });
  let recipient: NotificationPreferenceView["recipient"];
  const config = notificationMailConfig();
  try {
    const current = await readNotificationRecipient(identity.subject);
    recipient = current
      ? config && notificationRecipientAllowed(config, current)
        ? "ready"
        : "unavailable"
      : "missing";
  } catch (error) {
    if (error instanceof SellerError && error.code === "FORBIDDEN") throw error;
    recipient = "unavailable";
  }
  const saved = await inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    return (
      await tx.client.query<PreferenceRow>(
        `SELECT ${preferenceColumns} FROM treido.notification_email_preferences p WHERE p.user_id=$1`,
        [user.id],
      )
    ).rows[0];
  });
  return {
    actorKey: libraryActorKey(identity),
    actorSubject: identity.subject,
    revision: saved?.revision ?? 0,
    language,
    settings: {
      savedSearchEmail: saved?.savedSearchEmail ?? false,
      messageEmail: saved?.messageEmail ?? false,
    },
    recipient,
    deliveryAvailable: config !== null,
  };
}
