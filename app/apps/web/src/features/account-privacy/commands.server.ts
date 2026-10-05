import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import {
  parsePrivacyCommand,
  PRIVACY_LIMITS,
  PrivacyError,
  type Acknowledgment,
  type ClosureFacts,
} from "./model";
import {
  privacyActorKey,
  requirePrivacyStorage,
  requireRecentPrivacyIdentity,
} from "./storage.server";
import { projectExport, readClosureFacts } from "./projections.server";
import { buildSnapshot } from "./snapshot";
/** Immutable acknowledgments survive expiry/withdrawal. A replay never regenerates an export or applies another effect. */
export function changePrivacy(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<{ acknowledgment: Acknowledgment; replayed: boolean }> {
  const command = parsePrivacyCommand(raw);
  requireRecentPrivacyIdentity(identity);
  if (command.actorKey !== privacyActorKey(identity))
    throw new PrivacyError("UNAUTHENTICATED");
  return inTransaction(database, async (tx) => {
    await tx.client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    // All resources and receipts share one human workspace lock, followed by resource locks.
    await requirePrivacyStorage(tx.client);
    // Explicit authenticated command only: normal human registration creates no seller/consent/paid state.
    const user = await authorizeHuman(tx, identity, true);
    await tx.client.query(
      "INSERT INTO treido.account_privacy_workspaces(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [user.id],
    );
    const workspace = (
      await tx.client.query<{ revision: number }>(
        "SELECT revision FROM treido.account_privacy_workspaces WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    const hash = inputHash(command);
    const receipt = (
      await tx.client.query<{ hash: string; acknowledgment: Acknowledgment }>(
        "SELECT input_hash AS hash,acknowledgment FROM treido.account_privacy_receipts WHERE user_id=$1 AND request_id=$2",
        [user.id, command.requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.hash !== hash) throw new PrivacyError("CONFLICT");
      requireRecentPrivacyIdentity(identity);
      return { acknowledgment: receipt.acknowledgment, replayed: true };
    }
    if (workspace.revision !== command.expectedRevision)
      throw new PrivacyError("CONFLICT");
    const rate = (
      await tx.client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM treido.account_privacy_receipts WHERE user_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [user.id],
      )
    ).rows[0].count;
    if (rate >= PRIVACY_LIMITS.commandsPerMinute)
      throw new PrivacyError("QUOTA_EXCEEDED");
    const clock = (
      await tx.client.query<{ now: Date; expiry: Date }>(
        "SELECT clock_timestamp() AS now,clock_timestamp()+interval '15 minutes' AS expiry",
      )
    ).rows[0];
    const revision = workspace.revision + 1,
      op = command.operation;
    let resourceId: string = randomUUID(),
      acceptedState: Acknowledgment["acceptedState"],
      expiresAt: string | null = null;
    if (op.kind === "export") {
      // Deletes only this human's disposable expired export copies, never their source or commercial data.
      await tx.client.query(
        "DELETE FROM treido.account_privacy_exports WHERE user_id=$1 AND expires_at<=clock_timestamp()",
        [user.id],
      );
      const active = (
        await tx.client.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM treido.account_privacy_exports WHERE user_id=$1",
          [user.id],
        )
      ).rows[0].count;
      if (active >= PRIVACY_LIMITS.activeExports)
        throw new PrivacyError("QUOTA_EXCEEDED");
      const snapshot = buildSnapshot(
        user.id,
        clock.now.toISOString(),
        await projectExport(tx.client, user.id, op.categories),
      );
      await tx.client.query(
        `INSERT INTO treido.account_privacy_exports(user_id,id,categories,snapshot,created_at,expires_at) VALUES($1,$2,$3::jsonb,$4::jsonb,$5,$6)`,
        [
          user.id,
          resourceId,
          JSON.stringify(op.categories),
          JSON.stringify(snapshot),
          clock.now,
          clock.expiry,
        ],
      );
      acceptedState = "ready";
      expiresAt = clock.expiry.toISOString();
    } else if (op.kind === "review") {
      const facts = await readClosureFacts(tx.client, user.id);
      await tx.client.query(
        `INSERT INTO treido.account_privacy_reviews(user_id,id,facts,facts_hash,policy_version,created_at,expires_at) VALUES($1,$2,$3::jsonb,$4,'request-only-v1',$5,$6)`,
        [
          user.id,
          resourceId,
          JSON.stringify(facts),
          inputHash(facts),
          clock.now,
          clock.expiry,
        ],
      );
      acceptedState = "review";
      expiresAt = clock.expiry.toISOString();
    } else if (op.kind === "submit") {
      const review = (
        await tx.client.query<{
          facts: ClosureFacts;
          hash: string;
          valid: boolean;
          latest: boolean;
        }>(
          `SELECT facts,facts_hash AS hash,expires_at>clock_timestamp() AS valid,
        id=(SELECT id FROM treido.account_privacy_reviews WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1) AS latest
        FROM treido.account_privacy_reviews WHERE user_id=$1 AND id=$2`,
          [user.id, op.reviewId],
        )
      ).rows[0];
      if (!review) throw new PrivacyError("NOT_FOUND");
      if (!review.valid) throw new PrivacyError("EXPIRED");
      if (
        !review.latest ||
        review.hash !== inputHash(await readClosureFacts(tx.client, user.id))
      )
        throw new PrivacyError("CONFLICT");
      if (
        (
          await tx.client.query(
            "SELECT id FROM treido.account_closure_requests WHERE user_id=$1 AND (state='requested' OR review_id=$2)",
            [user.id, op.reviewId],
          )
        ).rows.length
      )
        throw new PrivacyError("CONFLICT");
      await tx.client.query(
        `INSERT INTO treido.account_closure_requests(user_id,id,review_id,state,acknowledged_at) VALUES($1,$2,$3,'requested',clock_timestamp())`,
        [user.id, resourceId, op.reviewId],
      );
      acceptedState = "requested";
    } else if (op.kind === "withdraw") {
      resourceId = op.closureId;
      const updated = await tx.client.query(
        `UPDATE treido.account_closure_requests SET state='withdrawn',revision=revision+1,updated_at=clock_timestamp() WHERE user_id=$1 AND id=$2 AND state='requested' RETURNING id`,
        [user.id, resourceId],
      );
      if (!updated.rows.length) throw new PrivacyError("NOT_FOUND");
      acceptedState = "withdrawn";
    } else {
      resourceId = op.exportId;
      const deleted = await tx.client.query(
        "DELETE FROM treido.account_privacy_exports WHERE user_id=$1 AND id=$2 RETURNING id",
        [user.id, resourceId],
      );
      if (!deleted.rows.length) throw new PrivacyError("NOT_FOUND");
      acceptedState = "discarded";
    }
    requireRecentPrivacyIdentity(identity);
    const acknowledgment: Acknowledgment = {
      revision,
      kind: op.kind,
      resourceId,
      acceptedState,
      expiresAt,
    };
    await tx.client.query(
      "UPDATE treido.account_privacy_workspaces SET revision=$2 WHERE user_id=$1",
      [user.id, revision],
    );
    await tx.client.query(
      `INSERT INTO treido.account_privacy_receipts(user_id,request_id,input_hash,accepted_revision,acknowledgment) VALUES($1,$2,$3,$4,$5::jsonb)`,
      [
        user.id,
        command.requestId,
        hash,
        revision,
        JSON.stringify(acknowledgment),
      ],
    );
    return { acknowledgment, replayed: false };
  });
}
