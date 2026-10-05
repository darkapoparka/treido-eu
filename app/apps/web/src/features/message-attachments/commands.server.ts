import "server-only";
import { randomUUID } from "node:crypto";
import { enqueueJob } from "../../server/jobs/outbox.server";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeConversation } from "../messaging/conversation-access.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  ATTACHMENT_LIMITS as L,
  ATTACHMENT_PURPOSE,
  intakeInput,
  assetInput,
  type AttachmentView,
  type AttachmentScope,
} from "./model";
import {
  requireAttachmentStorage,
  type AttachmentStorage,
} from "./storage.server";
import { checksumOf, rasterType } from "./raster.server";
export type Asset = {
  id: string;
  threadId: string;
  createdBy: string;
  revision: number;
  state: AttachmentView["state"];
  storageScope: string;
  purpose: string;
  sourceChecksum: string;
  contentType: string;
  bytes: number;
  sourceKey: string | null;
  objectKey: string;
  readyChecksum: string | null;
  readyBytes: number | null;
  width: number | null;
  height: number | null;
  jobId: string | null;
  operatingSellerId: string | null;
  expired: boolean;
  retryable: boolean;
  uploadToken: string | null;
  hash: string;
};
export const assetColumns = `id,thread_id AS "threadId",created_by AS "createdBy",revision,state,storage_scope AS "storageScope",purpose,source_checksum AS "sourceChecksum",content_type AS "contentType",bytes,source_key AS "sourceKey",object_key AS "objectKey",ready_checksum AS "readyChecksum",ready_bytes AS "readyBytes",width,height,job_id AS "jobId",operating_seller_id AS "operatingSellerId",expires_at<=clock_timestamp() AS expired,(state='staged' OR (state='uploading' AND upload_until<clock_timestamp())) AND upload_attempts<5 AS retryable,upload_token AS "uploadToken",input_hash AS hash`;
export const viewOf = (a: Asset): AttachmentView => ({
  id: a.id,
  revision: a.revision,
  state: a.state,
  retryable: a.retryable,
  width: a.width,
  height: a.height,
});
export function storageMatches(asset: Asset, storage: AttachmentStorage) {
  if (
    asset.storageScope !== storage.scope ||
    asset.purpose !== storage.purpose ||
    storage.purpose !== ATTACHMENT_PURPOSE
  )
    throw new SellerError("NOT_AVAILABLE");
}
export async function assetRow(
  tx: SellerTransaction,
  id: string,
  threadId?: string,
) {
  const row = (
    await tx.client.query<Asset>(
      "SELECT " +
        assetColumns +
        " FROM treido.message_attachments WHERE id=$1 AND ($2::uuid IS NULL OR thread_id=$2) FOR UPDATE",
      [id, threadId ?? null],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  return row;
}
export async function ownedAsset(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  input: AttachmentScope & { id: string },
  write = false,
) {
  const access = await authorizeConversation(
    tx,
    identity,
    input.threadId,
    write,
    { sellerId: input.sellerId },
  );
  const asset = await assetRow(tx, input.id, input.threadId);
  if (
    asset.createdBy !== access.user.id ||
    asset.operatingSellerId !== input.sellerId
  )
    throw new SellerError("NOT_FOUND");
  return { asset, access };
}
export async function registerObject(
  tx: SellerTransaction,
  storage: AttachmentStorage,
  asset: Asset,
  key: string,
  kind: "source" | "ready",
) {
  storageMatches(asset, storage);
  await tx.client.query(
    "INSERT INTO treido.message_attachment_objects(storage_scope,object_key,attachment_id,kind,write_until,retain_until) VALUES($1,$2,$3,$4,clock_timestamp()+make_interval(secs=>$5),clock_timestamp()+interval '24 hours')",
    [storage.scope, key, asset.id, kind, L.writerSeconds],
  );
}
export async function requireObject(
  tx: SellerTransaction,
  asset: Asset,
  key: string,
  writer = false,
) {
  const row = await tx.client.query(
    "SELECT object_key FROM treido.message_attachment_objects WHERE storage_scope=$1 AND object_key=$2 AND attachment_id=$3 AND state='tracked'" +
      (writer ? " AND write_until>clock_timestamp()" : "") +
      " FOR UPDATE",
    [asset.storageScope, key, asset.id],
  );
  if (row.rowCount !== 1) throw new SellerError("CONFLICT");
}
/** Uses the shared finite job contract and original outbox effect identity. */
export async function queueAttachmentJob(
  tx: SellerTransaction,
  asset: Asset,
  sellerId: string,
  kind: "message-attachment.process" | "message-attachment.expire",
) {
  const id = await enqueueJob(tx, {
    kind,
    sellerId,
    buyerId: null,
    resourceId: asset.id,
    operationKey: asset.id,
    actorId: asset.createdBy,
    authority: "attachment",
  });
  if (kind === "message-attachment.expire")
    await tx.client.query(
      "UPDATE treido.outbox_jobs SET available_at=(SELECT expires_at FROM treido.message_attachments WHERE id=$2) WHERE id=$1 AND state='pending' AND attempts=0",
      [id, asset.id],
    );
  return id;
}
export async function stageAttachment(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
  storage: AttachmentStorage = requireAttachmentStorage(),
) {
  const data = intakeInput(raw);
  return inTransaction(database, async (tx) => {
    const access = await authorizeConversation(
      tx,
      identity,
      data.threadId,
      true,
      { sellerId: data.sellerId },
    );
    await tx.client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 46009))",
      [access.user.id],
    );
    const hash = inputHash(data);
    const prior = (
      await tx.client.query<Asset>(
        "SELECT " +
          assetColumns +
          " FROM treido.message_attachments WHERE created_by=$1 AND thread_id=$2 AND request_id=$3 FOR UPDATE",
        [access.user.id, data.threadId, data.requestId],
      )
    ).rows[0];
    if (prior) {
      storageMatches(prior, storage);
      if (prior.hash !== hash || prior.state === "removed" || prior.expired)
        throw new SellerError("CONFLICT");
      return viewOf(prior);
    }
    const counts = (
      await tx.client.query<{
        human: number;
        thread: number;
        daily: number;
        bytes: number;
      }>(
        `SELECT count(*) FILTER(WHERE a.created_by=$1 AND a.state<>'removed' AND a.expires_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM treido.message_attachment_links WHERE attachment_id=a.id))::int AS human,count(*) FILTER(WHERE a.thread_id=$2 AND a.state<>'removed' AND a.expires_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM treido.message_attachment_links WHERE attachment_id=a.id))::int AS thread,count(*) FILTER(WHERE a.created_by=$1 AND a.created_at>clock_timestamp()-interval '24 hours')::int AS daily,coalesce(sum(bytes) FILTER(WHERE a.created_by=$1 AND a.created_at>clock_timestamp()-interval '24 hours'),0)::int AS bytes FROM treido.message_attachments a WHERE created_by=$1 OR thread_id=$2`,
        [access.user.id, data.threadId],
      )
    ).rows[0];
    if (
      counts.human >= L.pendingHuman ||
      counts.thread >= L.pendingThread ||
      counts.daily >= L.daily ||
      counts.bytes + data.bytes > L.dailyBytes
    )
      throw new SellerError("QUOTA_EXCEEDED");
    const id = randomUUID(),
      key = storage.prefix + "intake/" + id;
    const asset = (
      await tx.client.query<Asset>(
        "INSERT INTO treido.message_attachments(id,thread_id,created_by,state,content_type,bytes,object_key,storage_scope,purpose,request_id,input_hash,source_checksum,operating_seller_id) VALUES($1,$2,$3,'staged',$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING " +
          assetColumns,
        [
          id,
          data.threadId,
          access.user.id,
          data.contentType,
          data.bytes,
          key,
          storage.scope,
          storage.purpose,
          data.requestId,
          hash,
          data.checksum,
          data.sellerId,
        ],
      )
    ).rows[0];
    await queueAttachmentJob(
      tx,
      asset,
      access.thread.sellerId,
      "message-attachment.expire",
    );
    return viewOf(asset);
  });
}
export async function attachmentStatus(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const data = assetInput(raw);
  return inTransaction(database, async (tx) => {
    const { asset } = await ownedAsset(tx, identity, data);
    if (asset.expired && asset.state !== "removed")
      throw new SellerError("NOT_AVAILABLE");
    return viewOf(asset);
  });
}
export async function uploadAttachment(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
  bytes: Buffer,
  storage: AttachmentStorage = requireAttachmentStorage(),
) {
  const data = assetInput(raw);
  const claimed = await inTransaction(database, async (tx) => {
    const { asset } = await ownedAsset(tx, identity, data, true);
    storageMatches(asset, storage);
    if (asset.expired || asset.revision !== data.revision || !asset.retryable)
      throw new SellerError("CONFLICT");
    if (
      bytes.length !== asset.bytes ||
      bytes.length > L.bytes ||
      checksumOf(bytes) !== asset.sourceChecksum ||
      rasterType(bytes) !== asset.contentType
    )
      throw new SellerError("INVALID_INPUT");
    const token = randomUUID(),
      key = storage.prefix + "source/" + asset.id + "/" + token;
    await registerObject(tx, storage, asset, key, "source");
    await tx.client.query(
      "UPDATE treido.message_attachments SET state='uploading',revision=revision+1,source_key=$2,upload_token=$3,upload_until=clock_timestamp()+make_interval(secs=>$4),upload_attempts=upload_attempts+1 WHERE id=$1",
      [asset.id, key, token, L.writerSeconds],
    );
    return { ...asset, sourceKey: key, uploadToken: token };
  });
  try {
    // The unique immutable source is written only by this server; its accepted hash never changes.
    await storage.put(claimed.sourceKey, bytes);
    return await inTransaction(database, async (tx) => {
      const { asset, access } = await ownedAsset(tx, identity, data, true);
      storageMatches(asset, storage);
      if (
        asset.expired ||
        asset.state !== "uploading" ||
        asset.uploadToken !== claimed.uploadToken
      )
        throw new SellerError("CONFLICT");
      await requireObject(tx, asset, claimed.sourceKey, true);
      const jobId = await queueAttachmentJob(
        tx,
        asset,
        access.thread.sellerId,
        "message-attachment.process",
      );
      const row = (
        await tx.client.query<Asset>(
          "UPDATE treido.message_attachments SET state='processing',revision=revision+1,job_id=$2,upload_token=NULL,upload_until=NULL WHERE id=$1 RETURNING " +
            assetColumns,
          [asset.id, jobId],
        )
      ).rows[0];
      return viewOf(row);
    });
  } catch (error) {
    await inTransaction(database, async (tx) => {
      // No failed request can resurrect a removed/expired/replaced intake.
      const { asset } = await ownedAsset(tx, identity, data, true);
      if (
        asset.state === "uploading" &&
        asset.uploadToken === claimed.uploadToken &&
        !asset.expired
      )
        await tx.client.query(
          "UPDATE treido.message_attachments SET state='staged',revision=revision+1,upload_token=NULL,upload_until=NULL WHERE id=$1",
          [asset.id],
        );
    }).catch(() => undefined);
    throw error;
  }
}
export async function removeAttachment(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const data = assetInput(raw);
  return inTransaction(database, async (tx) => {
    const { asset } = await ownedAsset(tx, identity, data);
    if (asset.state === "removed") return viewOf(asset);
    if (asset.revision !== data.revision) throw new SellerError("CONFLICT");
    if (
      (
        await tx.client.query(
          "SELECT attachment_id FROM treido.message_attachment_links WHERE attachment_id=$1",
          [asset.id],
        )
      ).rowCount
    )
      throw new SellerError("CONFLICT");
    return viewOf(
      (
        await tx.client.query<Asset>(
          "UPDATE treido.message_attachments SET state='removed',revision=revision+1 WHERE id=$1 RETURNING " +
            assetColumns,
          [asset.id],
        )
      ).rows[0],
    );
  });
}
