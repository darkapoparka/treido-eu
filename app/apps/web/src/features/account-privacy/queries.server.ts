import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  PRIVACY_LIMITS,
  PrivacyError,
  type ClosureRequest,
  type ClosureReview,
  type ExportSummary,
  type PrivacyView,
} from "./model";
import {
  privacyActorKey,
  requirePrivacyStorage,
  requireRecentPrivacyIdentity,
} from "./storage.server";
import { readClosureFacts } from "./projections.server";
export function readPrivacy(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<PrivacyView> {
  requireRecentPrivacyIdentity(identity);
  return inTransaction(database, async (tx) => {
    await tx.client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await requirePrivacyStorage(tx.client);
    const clock = (
      await tx.client.query<{ now: Date }>("SELECT clock_timestamp() AS now")
    ).rows[0].now;
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (!(error instanceof SellerError) || error.code !== "NOT_FOUND")
        throw error;
      requireRecentPrivacyIdentity(identity);
      return {
        actorKey: privacyActorKey(identity),
        revision: 0,
        checkedAt: clock.toISOString(),
        registrationNeeded: true,
        facts: null,
        exports: [],
        reviews: [],
        closures: [],
        historyLimited: false,
      };
    }
    const revision =
      (
        await tx.client.query<{ revision: number }>(
          "SELECT revision FROM treido.account_privacy_workspaces WHERE user_id=$1",
          [user.id],
        )
      ).rows[0]?.revision ?? 0;
    const exports = (
      await tx.client.query<
        Omit<ExportSummary, "createdAt" | "expiresAt"> & {
          createdAt: Date;
          expiresAt: Date;
        }
      >(
        `SELECT id,created_at AS "createdAt",expires_at AS "expiresAt",categories,
      octet_length(snapshot::text) AS bytes,expires_at>clock_timestamp() AS downloadable
      FROM treido.account_privacy_exports WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,
        [user.id, PRIVACY_LIMITS.history + 1],
      )
    ).rows;
    const reviews = (
      await tx.client.query<
        Omit<
          ClosureReview,
          "completionAvailable" | "createdAt" | "expiresAt"
        > & { createdAt: Date; expiresAt: Date }
      >(
        `SELECT id,facts,policy_version AS "policyVersion",created_at AS "createdAt",expires_at AS "expiresAt"
      FROM treido.account_privacy_reviews WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,
        [user.id, PRIVACY_LIMITS.history + 1],
      )
    ).rows;
    const closures = (
      await tx.client.query<
        Omit<ClosureRequest, "createdAt" | "updatedAt"> & {
          createdAt: Date;
          updatedAt: Date;
        }
      >(
        `SELECT id,review_id AS "reviewId",state,created_at AS "createdAt",updated_at AS "updatedAt"
      FROM treido.account_closure_requests WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,
        [user.id, PRIVACY_LIMITS.history + 1],
      )
    ).rows;
    const facts = await readClosureFacts(tx.client, user.id);
    requireRecentPrivacyIdentity(identity);
    return {
      actorKey: privacyActorKey(identity),
      revision,
      checkedAt: clock.toISOString(),
      registrationNeeded: false,
      facts,
      exports: exports.slice(0, PRIVACY_LIMITS.history).map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      })),
      reviews: reviews.slice(0, PRIVACY_LIMITS.history).map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        completionAvailable: false as const,
      })),
      closures: closures.slice(0, PRIVACY_LIMITS.history).map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      historyLimited: [exports, reviews, closures].some(
        (rows) => rows.length > PRIVACY_LIMITS.history,
      ),
    };
  });
}
export function readPrivateDownload(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  id: string,
  actorKey: string,
): Promise<string> {
  requireRecentPrivacyIdentity(identity);
  if (actorKey !== privacyActorKey(identity))
    throw new PrivacyError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    await requirePrivacyStorage(tx.client);
    const row = (
      await tx.client.query<{ body: string; valid: boolean }>(
        `SELECT snapshot::text AS body,expires_at>clock_timestamp() AS valid
      FROM treido.account_privacy_exports WHERE user_id=$1 AND id=$2`,
        [user.id, id],
      )
    ).rows[0];
    if (!row) throw new PrivacyError("NOT_FOUND");
    if (!row.valid) throw new PrivacyError("EXPIRED");
    if (Buffer.byteLength(row.body, "utf8") > PRIVACY_LIMITS.bytes)
      throw new PrivacyError("NOT_AVAILABLE");
    requireRecentPrivacyIdentity(identity);
    return row.body;
  });
}
