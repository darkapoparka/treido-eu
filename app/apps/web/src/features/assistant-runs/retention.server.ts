import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { inputMediaStorage } from "./media.server";
import { runtimePolicy, requirePolicy } from "./policy.server";
import { lockInputSpending } from "./storage.server";
import {
  authorizeAssistantMaintenance,
  type AssistantMaintenanceContext,
} from "./maintenance-authority.server";
/** Bound to the original accepted artifact. Never enumerate the bucket, invent
 * an object, extend an upload lease or release possibly emitted spending. */
export async function expireAssistantRun(
  database: SellerDatabase,
  job: AssistantMaintenanceContext,
) {
  await inTransaction(database, async (tx) => {
    await authorizeAssistantMaintenance(tx, job, "assistant.run-expiry");
    await lockInputSpending(tx);
    await tx.client.query(
      "UPDATE treido.assistant_runs SET state='cancelled',input_json=NULL,proposal=NULL,accepted_criteria=NULL WHERE id=$1 AND user_id=$2 AND expires_at<=clock_timestamp()",
      [job.resourceId, job.buyerId],
    );
    await tx.client.query(
      "UPDATE treido.assistant_run_reservations b SET status=CASE WHEN r.emission_started_at IS NULL AND r.steps=0 THEN 'released' ELSE 'unknown' END FROM treido.assistant_runs r WHERE b.run_id=r.id AND b.run_id=$1 AND b.user_id=$2 AND b.status IN ('reserved','calling')",
      [job.resourceId, job.buyerId],
    );
    await tx.client.query(
      "UPDATE treido.buyer_assistant_workspaces SET current_run_id=NULL,revision=revision+1 WHERE user_id=$1 AND current_run_id=$2",
      [job.buyerId, job.resourceId],
    );
  });
}
export async function expireAssistantMedia(
  database: SellerDatabase,
  job: AssistantMaintenanceContext,
) {
  let deleted = 0;
  // Photo owns at most staging/immutable/ready; voice staging/immutable.
  for (let step = 0; step < 3; step++) {
    const claim = await inTransaction(database, async (tx) => {
      await authorizeAssistantMaintenance(tx, job, "assistant.media-expiry");
      const policy = requirePolicy(await runtimePolicy(tx)),
        storage = inputMediaStorage(policy);
      const object = (
        await tx.client.query<{ key: string; scope: string }>(
          "SELECT object_key AS key,storage_scope AS scope FROM treido.assistant_media_objects WHERE asset_id=$1 AND user_id=$2 AND state<>'deleted' AND write_until<=clock_timestamp() AND retain_until<=clock_timestamp() AND (deletion_until IS NULL OR deletion_until<=clock_timestamp()) ORDER BY storage_scope,object_key LIMIT 1 FOR UPDATE",
          [job.resourceId, job.buyerId],
        )
      ).rows[0];
      if (!object) return null;
      if (
        object.scope !== storage.scope ||
        !object.key.startsWith(storage.prefix)
      )
        throw new SellerError("NOT_AVAILABLE");
      const token = randomUUID();
      await tx.client.query(
        "UPDATE treido.assistant_media_assets SET state='expired' WHERE id=$1 AND user_id=$2",
        [job.resourceId, job.buyerId],
      );
      await tx.client.query(
        "UPDATE treido.assistant_media_objects SET state='deleting',deletion_token=$4,deletion_until=clock_timestamp()+interval '60 seconds' WHERE asset_id=$1 AND user_id=$2 AND object_key=$3 AND storage_scope=$5",
        [job.resourceId, job.buyerId, object.key, token, object.scope],
      );
      return { key: object.key, scope: object.scope, token, storage };
    });
    if (!claim) break;
    // Revalidate the original job before exact-key external I/O. Lost delete
    // acknowledgment keeps its tombstone; expiry recovery repeats only the
    // idempotent unversioned DELETE of that same ended lease, never a PUT.
    await inTransaction(database, async (tx) => {
      await authorizeAssistantMaintenance(tx, job, "assistant.media-expiry");
      const current = inputMediaStorage(requirePolicy(await runtimePolicy(tx)));
      if (current.scope !== claim.scope) throw new SellerError("NOT_AVAILABLE");
    });
    await claim.storage.remove(claim.key);
    await inTransaction(database, async (tx) => {
      await authorizeAssistantMaintenance(tx, job, "assistant.media-expiry");
      const current = inputMediaStorage(requirePolicy(await runtimePolicy(tx)));
      if (current.scope !== claim.scope) throw new SellerError("NOT_AVAILABLE");
      const confirmed = await tx.client.query(
        "UPDATE treido.assistant_media_objects SET state='deleted',deleted_at=clock_timestamp(),deletion_token=NULL,deletion_until=NULL WHERE asset_id=$1 AND user_id=$2 AND storage_scope=$3 AND object_key=$4 AND state='deleting' AND deletion_token=$5 AND deletion_until>clock_timestamp()",
        [job.resourceId, job.buyerId, claim.scope, claim.key, claim.token],
      );
      if (confirmed.rowCount !== 1) throw new SellerError("CONFLICT");
    });
    deleted++;
  }
  return inTransaction(database, async (tx) => {
    await authorizeAssistantMaintenance(tx, job, "assistant.media-expiry");
    const remaining = (
      await tx.client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM treido.assistant_media_objects WHERE asset_id=$1 AND user_id=$2 AND state<>'deleted'",
        [job.resourceId, job.buyerId],
      )
    ).rows[0];
    if (!remaining || !Number.isSafeInteger(remaining.count))
      throw new SellerError("NOT_AVAILABLE");
    if (!remaining.count)
      await tx.client.query(
        "UPDATE treido.buyer_assistant_workspaces SET current_asset_id=NULL,revision=revision+1 WHERE user_id=$1 AND current_asset_id=$2",
        [job.buyerId, job.resourceId],
      );
    return { deleted, pending: remaining.count > 0 };
  });
}
