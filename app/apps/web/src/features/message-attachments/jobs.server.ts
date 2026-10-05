import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { EffectResult } from "../../server/jobs/execution.server";
import { authorizeConversation } from "../messaging/conversation-access.server";
import { SellerError } from "../sellers/errors";
import {
  assetRow,
  storageMatches,
  registerObject,
  requireObject,
} from "./commands.server";
import {
  requireAttachmentStorage,
  type AttachmentStorage,
} from "./storage.server";
import { ATTACHMENT_LIMITS as L } from "./model";
import { reencodeAttachment } from "./raster.server";
import { purgeAttachmentObjects } from "./retention.server";
export type AttachmentJob = {
  id: string;
  kind: "message-attachment.process" | "message-attachment.expire";
  sellerId: string;
  buyerId: null;
  resourceId: string;
  operationKey: string;
  actorId: string;
  authority: "attachment";
  generation: number;
  state?: string;
  executionToken?: string;
};
/** Called by the shared executor BEFORE taking its outbox/effect locks, and again after external I/O. */
export async function authorizeAttachmentJob(
  tx: SellerTransaction,
  job: AttachmentJob,
  executionToken?: string,
) {
  const initial = (
    await tx.client.query<{ threadId: string }>(
      'SELECT thread_id AS "threadId" FROM treido.message_attachments WHERE id=$1 AND created_by=$2',
      [job.resourceId, job.actorId],
    )
  ).rows[0];
  if (
    !initial ||
    job.operationKey !== job.resourceId ||
    job.authority !== "attachment" ||
    job.buyerId !== null
  )
    throw new SellerError("FORBIDDEN");
  if (job.kind === "message-attachment.process") {
    const actor = (
      await tx.client.query<{ subject: string; sellerId: string | null }>(
        'SELECT u.clerk_subject AS subject,a.operating_seller_id AS "sellerId" FROM treido.users u JOIN treido.message_attachments a ON a.created_by=u.id WHERE a.id=$1 AND u.id=$2',
        [job.resourceId, job.actorId],
      )
    ).rows[0];
    if (!actor) throw new SellerError("FORBIDDEN");
    const access = await authorizeConversation(
      tx,
      { subject: actor.subject },
      initial.threadId,
      true,
      { sellerId: actor.sellerId },
    );
    if (access.thread.sellerId !== job.sellerId)
      throw new SellerError("FORBIDDEN");
  }
  const asset = await assetRow(tx, job.resourceId);
  const owner = (
    await tx.client.query<{ sellerId: string }>(
      'SELECT seller_id AS "sellerId" FROM treido.conversation_threads WHERE id=$1',
      [asset.threadId],
    )
  ).rows[0];
  if (
    owner?.sellerId !== job.sellerId ||
    asset.createdBy !== job.actorId ||
    asset.purpose !== "private-message-images-v1"
  )
    throw new SellerError("FORBIDDEN");
  if (job.kind === "message-attachment.process") {
    if (asset.jobId !== job.id) throw new SellerError("FORBIDDEN");
    const completed =
      !executionToken &&
      job.state === "completed" &&
      (
        await tx.client.query(
          "SELECT job_id FROM treido.job_effects WHERE job_id=$1 AND state='completed' AND result_id=$2",
          [job.id, asset.id],
        )
      ).rowCount === 1;
    if (!completed && (asset.state !== "processing" || asset.expired))
      throw new SellerError("FORBIDDEN");
  }
  if (
    executionToken &&
    !(
      await tx.client.query(
        "SELECT e.job_id FROM treido.job_effects e JOIN treido.outbox_jobs j ON j.id=e.job_id WHERE j.id=$1 AND j.kind=$2 AND j.resource_id=$3 AND j.actor_id=$4 AND j.seller_id=$5 AND j.generation=$6 AND j.state IN('pending','accepted') AND e.state='running' AND e.execution_token=$7 AND e.execution_until>clock_timestamp()",
        [
          job.id,
          job.kind,
          asset.id,
          asset.createdBy,
          job.sellerId,
          job.generation,
          executionToken,
        ],
      )
    ).rowCount
  )
    throw new SellerError("CONFLICT");
  return asset;
}
export async function processAttachmentJob(
  database: SellerDatabase,
  job: AttachmentJob & { executionToken: string },
  storage: AttachmentStorage = requireAttachmentStorage(),
): Promise<EffectResult> {
  const asset = await inTransaction(database, async (tx) => {
    const a = await authorizeAttachmentJob(tx, job, job.executionToken);
    storageMatches(a, storage);
    if (!a.sourceKey) throw new SellerError("NOT_AVAILABLE");
    await requireObject(tx, a, a.sourceKey);
    return a;
  });
  const original = await storage.read(asset.sourceKey!, L.bytes);
  let result;
  try {
    result = await reencodeAttachment(original, {
      checksum: asset.sourceChecksum,
      bytes: asset.bytes,
      contentType: asset.contentType,
    });
  } catch (error) {
    if (!(error instanceof SellerError) || error.code !== "INVALID_INPUT")
      throw error;
    return {
      resultId: asset.id,
      apply: async (tx) => {
        const a = await assetRow(tx, asset.id);
        if (a.state === "processing")
          await tx.client.query(
            "UPDATE treido.message_attachments SET state='removed',revision=revision+1 WHERE id=$1",
            [a.id],
          );
      },
    };
  }
  const key =
    storage.prefix + "ready/" + asset.id + "/" + randomUUID() + ".webp";
  await inTransaction(database, async (tx) => {
    const current = await authorizeAttachmentJob(tx, job, job.executionToken);
    storageMatches(current, storage);
    await registerObject(tx, storage, current, key, "ready");
  });
  await storage.put(key, result.bytes);
  return {
    resultId: asset.id,
    lock: async (tx) => {
      const current = await authorizeAttachmentJob(tx, job);
      storageMatches(current, storage);
      await requireObject(tx, current, key, true);
    },
    apply: async (tx) => {
      const current = await assetRow(tx, asset.id);
      storageMatches(current, storage);
      if (current.state !== "processing" || current.expired)
        throw new SellerError("CONFLICT");
      await requireObject(tx, current, key, true);
      await tx.client.query(
        "UPDATE treido.message_attachments SET state='ready',revision=revision+1,object_key=$2,ready_checksum=$3,ready_bytes=$4,width=$5,height=$6 WHERE id=$1",
        [
          asset.id,
          key,
          result.checksum,
          result.bytes.length,
          result.width,
          result.height,
        ],
      );
    },
  };
}
export async function expireAttachmentJob(
  database: SellerDatabase,
  job: AttachmentJob & { executionToken: string },
  storage: AttachmentStorage = requireAttachmentStorage(),
): Promise<EffectResult> {
  const asset = await inTransaction(database, async (tx) => {
    const a = await authorizeAttachmentJob(tx, job, job.executionToken);
    storageMatches(a, storage);
    const linked = (
      await tx.client.query(
        "SELECT attachment_id FROM treido.message_attachment_links WHERE attachment_id=$1",
        [a.id],
      )
    ).rowCount;
    if (!linked && a.expired && a.state !== "removed")
      await tx.client.query(
        "UPDATE treido.message_attachments SET state='removed',revision=revision+1 WHERE id=$1",
        [a.id],
      );
    return a;
  });
  await purgeAttachmentObjects(database, storage, asset.id);
  return { resultId: asset.id };
}
