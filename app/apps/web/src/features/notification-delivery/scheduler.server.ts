import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  notificationSourceLink,
  type NotificationSource,
} from "./source.server";
import { notificationMailConfig } from "./config.server";
import {
  notificationStorageReady,
  preferenceColumns,
  type PreferenceRow,
} from "./preferences.server";
type Candidate = NotificationSource & { subject: string; generation: number };
async function enqueueNotification(
  tx: SellerTransaction,
  id: string,
  userId: string,
) {
  return enqueueJob(tx, {
    kind: "buyer.notification-email",
    authority: "notification",
    sellerId: null,
    buyerId: userId,
    actorId: null,
    resourceId: id,
    operationKey: id,
  });
}
export async function scheduleNotificationEmails(database: SellerDatabase) {
  if (
    !notificationMailConfig() ||
    !(await notificationStorageReady({ client: database.pool }))
  )
    return { available: false, scheduled: 0, cancelled: 0 };
  const candidates = (
    await database.pool.query<Candidate>(`WITH sources AS (
    SELECT n.user_id AS "userId",'saved-search' AS kind,n.id AS "sourceId",n.consent_generation AS "sourceRevision",NULL::uuid AS "sellerId",n.created_at AS at FROM treido.buyer_search_notifications n JOIN treido.buyer_saved_searches s ON s.id=n.search_id AND s.user_id=n.user_id WHERE s.status='enabled' AND s.consent_at IS NOT NULL AND n.consent_generation=s.consent_generation AND n.criteria_version=s.criteria_version AND n.kind<>'unavailable' AND n.read_at IS NULL
    UNION ALL
    SELECT u.id,'message',m.id,m.sequence,CASE WHEN n.recipient_side='seller' THEN c.seller_id ELSE NULL END,m.created_at FROM treido.message_notification_intents n JOIN treido.messages m ON m.id=n.message_id AND m.thread_id=n.thread_id JOIN treido.conversation_threads c ON c.id=m.thread_id JOIN treido.users u ON (n.recipient_side='buyer' AND u.id=c.buyer_id) OR (n.recipient_side='seller' AND (EXISTS(SELECT 1 FROM treido.personal_seller_owners o WHERE o.seller_id=c.seller_id AND o.user_id=u.id) OR EXISTS(SELECT 1 FROM treido.seller_memberships sm WHERE sm.seller_id=c.seller_id AND sm.user_id=u.id AND sm.status='active'))) WHERE m.author_id<>u.id)
    SELECT x."userId",x.kind,x."sourceId",x."sourceRevision",x."sellerId",u.clerk_subject AS subject,p.language,p.consent_generation AS generation FROM sources x JOIN treido.users u ON u.id=x."userId" JOIN treido.notification_email_preferences p ON p.user_id=u.id
    WHERE u.status='active' AND p.consent_at IS NOT NULL AND x.at>=p.consent_at AND x.at>clock_timestamp()-interval '7 days' AND CASE WHEN x.kind='message' THEN p.message_email ELSE p.saved_search_email END
    AND NOT EXISTS(SELECT 1 FROM treido.notification_email_deliveries d WHERE d.user_id=u.id AND d.kind=x.kind AND d.source_id=x."sourceId" AND d.consent_generation=p.consent_generation)
    ORDER BY x.at,x."sourceId",u.id LIMIT 20`)
  ).rows;
  let scheduled = 0,
    cancelled = 0;
  for (const candidate of candidates) {
    let result: string;
    try {
      result = await inTransaction(database, async (tx) => {
        const user = await authorizeHuman(
          tx,
          { subject: candidate.subject },
          false,
        );
        let allowed = true;
        try {
          await notificationSourceLink(tx, candidate, candidate.subject);
        } catch (error) {
          if (
            !(error instanceof SellerError) ||
            !["FORBIDDEN", "NOT_FOUND"].includes(error.code)
          )
            throw error;
          allowed = false;
        }
        const preference = (
          await tx.client.query<PreferenceRow>(
            `SELECT ${preferenceColumns} FROM treido.notification_email_preferences p WHERE p.user_id=$1 FOR SHARE`,
            [user.id],
          )
        ).rows[0];
        if (
          !preference ||
          preference.generation !== candidate.generation ||
          !preference.consentAt ||
          !(candidate.kind === "message"
            ? preference.messageEmail
            : preference.savedSearchEmail)
        )
          return "stale";
        const row = (
          await tx.client.query<{ id: string }>(
            `INSERT INTO treido.notification_email_deliveries(id,user_id,kind,source_id,source_revision,seller_id,consent_generation,language,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,kind,source_id,consent_generation) DO NOTHING RETURNING id`,
            [
              randomUUID(),
              user.id,
              candidate.kind,
              candidate.sourceId,
              candidate.sourceRevision,
              candidate.sellerId,
              preference.generation,
              preference.language,
              allowed ? "pending" : "cancelled",
            ],
          )
        ).rows[0];
        if (!row) return "stale";
        if (!allowed) return "cancelled";
        await enqueueNotification(tx, row.id, user.id);
        return "scheduled";
      });
    } catch (error) {
      // Account closure during selection must not stop another recipient's batch.
      if (
        !(error instanceof SellerError) ||
        !["FORBIDDEN", "NOT_FOUND"].includes(error.code)
      )
        throw error;
      continue;
    }
    if (result === "scheduled") scheduled++;
    if (result === "cancelled") cancelled++;
  }
  // Delivery and original job/effect are created atomically. Existing outbox
  // lease repair/redrive retries that identity; scheduling never revives it.
  return { available: true, scheduled, cancelled };
}
