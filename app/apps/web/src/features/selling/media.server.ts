import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "./draft-model";
import {
  MEDIA_LIMITS,
  validUpload,
  type MediaUploadInput,
  type MediaView,
} from "./media-model";
import type { MediaStorage } from "../../server/media/storage.server";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { processPhoto } from "../../server/media/process.server";
import type {
  EffectContext,
  EffectResult,
} from "../../server/jobs/execution.server";

type Asset = MediaView & {
  sellerId: string;
  listingId: string;
  createdBy: string;
  requestId: string;
  inputHash: string;
  expectedBytes: number;
  contentType: string;
  expectedChecksum: string;
  stagingKey: string;
  immutableKey: string | null;
  derivativeKey: string | null;
  derivativeChecksum: string | null;
  jobId: string | null;
  expiresAt: Date;
};
const columns = `id,seller_id AS "sellerId",listing_id AS "listingId",created_by AS "createdBy",request_id AS "requestId",
  input_hash AS "inputHash",state,expected_bytes AS "expectedBytes",content_type AS "contentType",
  expected_checksum AS "expectedChecksum",staging_key AS "stagingKey",immutable_key AS "immutableKey",
  derivative_key AS "derivativeKey",derivative_checksum AS "derivativeChecksum",position,width,height,revision,job_id AS "jobId",error_code AS error,expires_at AS "expiresAt"`;
async function ownedDraft(
  tx: SellerTransaction,
  sellerId: string,
  draftId: string,
  write: boolean,
) {
  if (!validId(draftId)) throw new SellerError("INVALID_INPUT");
  const row = (
    await tx.client.query<{ publication: string; moderation: string }>(
      `SELECT publication,moderation_state AS moderation FROM treido.listings WHERE seller_id=$1 AND id=$2 FOR ${write ? "UPDATE" : "SHARE"}`,
      [sellerId, draftId],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  if (row.moderation !== "clear") throw new SellerError("NOT_FOUND");
  if (!["draft", "withdrawn"].includes(row.publication))
    throw new SellerError("CONFLICT");
}
const view = (asset: Asset): MediaView => ({
  id: asset.id,
  state: asset.state,
  position: asset.position,
  width: asset.width,
  height: asset.height,
  revision: asset.revision,
  error: asset.error,
});
export async function listDraftMedia(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  draftId: string,
) {
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    await ownedDraft(tx, sellerId, draftId, false);
    const rows = await tx.client.query<Asset>(
      `SELECT ${columns} FROM treido.media_assets WHERE seller_id=$1 AND listing_id=$2 AND state<>'detached' ORDER BY position,id LIMIT 12`,
      [sellerId, draftId],
    );
    const results: MediaView[] = [];
    for (const row of rows.rows) {
      const projected = view(row);
      if (row.state === "processing" && row.jobId) {
        const job = (
          await tx.client.query<{ state: string }>(
            "SELECT state FROM treido.outbox_jobs WHERE seller_id=$1 AND id=$2",
            [sellerId, row.jobId],
          )
        ).rows[0];
        if (job?.state === "dead" || job?.state === "cancelled") {
          projected.state = "failed";
          projected.error = "processing_unavailable";
        }
      }
      results.push(projected);
    }
    return results;
  });
}
export async function createMediaIntent(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: MediaUploadInput,
  storage: MediaStorage,
) {
  if (!validUpload(input)) throw new SellerError("INVALID_INPUT");
  const hash = inputHash(input);
  const asset = await inTransaction(database, async (tx) => {
    const { user } = await authorizeSeller(
      tx,
      identity,
      input.sellerId,
      "listing.write",
    );
    await ownedDraft(tx, input.sellerId, input.draftId, true);
    const previous = (
      await tx.client.query<Asset>(
        `SELECT ${columns} FROM treido.media_assets WHERE seller_id=$1 AND created_by=$2 AND request_id=$3 FOR UPDATE`,
        [input.sellerId, user.id, input.requestId],
      )
    ).rows[0];
    if (previous) {
      if (previous.inputHash !== hash || previous.state !== "staged")
        throw new SellerError("CONFLICT");
      const renewed = (
        await tx.client.query<{ expiresAt: Date }>(
          `UPDATE treido.media_assets SET expires_at=clock_timestamp()+make_interval(secs=>$2) WHERE id=$1 RETURNING expires_at AS "expiresAt"`,
          [previous.id, MEDIA_LIMITS.uploadSeconds],
        )
      ).rows[0];
      return { ...previous, expiresAt: renewed.expiresAt };
    }
    const positions = (
      await tx.client.query<{ position: number }>(
        "SELECT position FROM treido.media_assets WHERE seller_id=$1 AND listing_id=$2 AND state<>'detached'",
        [input.sellerId, input.draftId],
      )
    ).rows;
    if (positions.length >= MEDIA_LIMITS.count)
      throw new SellerError("QUOTA_EXCEEDED");
    const position = Array.from(
      { length: MEDIA_LIMITS.count },
      (_, i) => i,
    ).find((i) => !positions.some((row) => row.position === i))!;
    const id = randomUUID();
    const key = `${storage.prefix}staging/${input.sellerId}/${id}`;
    const created = await tx.client.query<Asset>(
      `INSERT INTO treido.media_assets
      (id,seller_id,listing_id,created_by,request_id,input_hash,expected_bytes,content_type,expected_checksum,staging_key,position,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp()+make_interval(secs=>$12)) RETURNING ${columns}`,
      [
        id,
        input.sellerId,
        input.draftId,
        user.id,
        input.requestId,
        hash,
        input.bytes,
        input.contentType,
        input.checksum,
        key,
        position,
        MEDIA_LIMITS.uploadSeconds,
      ],
    );
    return created.rows[0];
  });
  const signed = await storage.upload(asset.stagingKey, input);
  // Signing happens outside authority locks; check again before returning bearer access.
  await inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, input.sellerId, "listing.write");
    await ownedDraft(tx, input.sellerId, input.draftId, false);
    const current = await tx.client.query(
      `SELECT id FROM treido.media_assets WHERE id=$1 AND seller_id=$2
      AND listing_id=$3 AND state='staged' AND expires_at > clock_timestamp() FOR SHARE`,
      [asset.id, input.sellerId, input.draftId],
    );
    if (current.rowCount !== 1) throw new SellerError("CONFLICT");
  });
  return {
    assetId: asset.id,
    ...signed,
    expiresAt: asset.expiresAt.toISOString(),
  };
}
export async function completeMediaUpload(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: { sellerId: string; draftId: string; assetId: string },
  storage: MediaStorage,
) {
  if (!validId(input.assetId)) throw new SellerError("INVALID_INPUT");
  const asset = await inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, input.sellerId, "listing.write");
    await ownedDraft(tx, input.sellerId, input.draftId, false);
    const row = (
      await tx.client.query<Asset>(
        `SELECT ${columns} FROM treido.media_assets WHERE seller_id=$1 AND listing_id=$2 AND id=$3`,
        [input.sellerId, input.draftId, input.assetId],
      )
    ).rows[0];
    if (!row || row.state === "detached") throw new SellerError("NOT_FOUND");
    return row;
  });
  if (["processing", "ready"].includes(asset.state))
    return { assetId: asset.id, state: asset.state };
  if (asset.state !== "staged" || asset.expiresAt.getTime() <= Date.now())
    throw new SellerError("CONFLICT");
  const head = await storage.head(asset.stagingKey);
  if (head.bytes !== asset.expectedBytes)
    throw new SellerError("INVALID_INPUT");
  const frozen = `${storage.prefix}immutable/${asset.sellerId}/${asset.id}/${randomUUID()}`;
  await storage.freeze(asset.stagingKey, head.etag, frozen);
  return inTransaction(database, async (tx) => {
    const { user } = await authorizeSeller(
      tx,
      identity,
      input.sellerId,
      "listing.write",
    );
    await ownedDraft(tx, input.sellerId, input.draftId, true);
    const current = (
      await tx.client.query<Asset>(
        `SELECT ${columns} FROM treido.media_assets WHERE seller_id=$1 AND listing_id=$2 AND id=$3 FOR UPDATE`,
        [input.sellerId, input.draftId, input.assetId],
      )
    ).rows[0];
    if (!current || current.state === "detached")
      throw new SellerError("NOT_FOUND");
    if (["processing", "ready"].includes(current.state))
      return { assetId: current.id, state: current.state };
    if (current.state !== "staged" || current.expiresAt.getTime() <= Date.now())
      throw new SellerError("CONFLICT");
    const jobId = await enqueueJob(tx, {
      kind: "media.process",
      sellerId: current.sellerId,
      resourceId: current.id,
      operationKey: current.id,
      actorId: user.id,
      authority: "member",
    });
    await tx.client.query(
      `UPDATE treido.media_assets SET state='processing',immutable_key=$2,source_etag=$3,job_id=$4,revision=revision+1 WHERE id=$1`,
      [current.id, frozen, head.etag, jobId],
    );
    return { assetId: current.id, state: "processing" };
  });
}
export async function changeDraftMedia(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: {
    sellerId: string;
    draftId: string;
    assets: Array<{ id: string; revision: number }>;
    removeId?: string;
  },
) {
  if (
    !Array.isArray(input.assets) ||
    input.assets.length > 12 ||
    input.assets.some(
      (item) =>
        !validId(item?.id) ||
        !Number.isSafeInteger(item.revision) ||
        item.revision < 1,
    ) ||
    new Set(input.assets.map((item) => item.id)).size !== input.assets.length ||
    (input.removeId !== undefined && !validId(input.removeId))
  )
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, input.sellerId, "listing.write");
    await ownedDraft(tx, input.sellerId, input.draftId, true);
    const current = (
      await tx.client.query<Asset>(
        `SELECT ${columns} FROM treido.media_assets WHERE seller_id=$1 AND listing_id=$2 AND state<>'detached' ORDER BY id FOR UPDATE`,
        [input.sellerId, input.draftId],
      )
    ).rows;
    if (
      current.length !== input.assets.length ||
      input.assets.some(
        (item) =>
          !current.some(
            (row) => row.id === item.id && row.revision === item.revision,
          ),
      )
    )
      throw new SellerError("CONFLICT");
    const removed = input.removeId
      ? current.find((row) => row.id === input.removeId)
      : null;
    if (input.removeId && !removed) throw new SellerError("NOT_FOUND");
    if (removed) {
      await tx.client.query(
        "UPDATE treido.media_assets SET state='detached',revision=revision+1 WHERE id=$1",
        [removed.id],
      );
      if (removed.jobId) {
        await tx.client.query(
          `UPDATE treido.outbox_jobs SET state='cancelled',dispatch_token=NULL,dispatch_until=NULL
          WHERE id=$1 AND seller_id=$2 AND state IN ('pending','accepted','dead')`,
          [removed.jobId, input.sellerId],
        );
        await tx.client.query(
          `UPDATE treido.job_effects SET state='cancelled',execution_token=NULL,execution_until=NULL WHERE job_id=$1 AND state<>'completed'`,
          [removed.jobId],
        );
      }
    }
    let position = 0;
    for (const item of input.assets)
      if (item.id !== input.removeId)
        await tx.client.query(
          "UPDATE treido.media_assets SET position=$2,revision=revision+1 WHERE id=$1",
          [item.id, position++],
        );
    return { changed: true };
  });
}
export async function processMediaJob(
  database: SellerDatabase,
  job: EffectContext,
  storage: MediaStorage,
): Promise<EffectResult> {
  const asset = (
    await database.pool.query<Asset>(
      `SELECT ${columns} FROM treido.media_assets WHERE seller_id=$1 AND id=$2 AND job_id=$3 AND state='processing'`,
      [job.sellerId, job.resourceId, job.id],
    )
  ).rows[0];
  if (!asset || !asset.immutableKey) throw new SellerError("FORBIDDEN");
  let processed;
  try {
    processed = await processPhoto(
      await storage.read(asset.immutableKey, MEDIA_LIMITS.bytes),
      asset.expectedChecksum,
    );
  } catch (error) {
    if (error instanceof SellerError && error.code === "INVALID_INPUT")
      await database.pool.query(
        `UPDATE treido.media_assets SET state='failed',error_code='invalid_bytes',revision=revision+1 WHERE id=$1 AND state='processing' AND job_id=$2`,
        [asset.id, job.id],
      );
    throw error;
  }
  const key = `${storage.prefix}ready/${asset.sellerId}/${asset.id}/${processed.checksum}.webp`;
  await storage.put(key, processed.bytes);
  return {
    resultId: asset.id,
    lock: async (tx) => {
      await ownedDraft(tx, asset.sellerId, asset.listingId, true);
      const current = (
        await tx.client.query<{ state: string; key: string }>(
          `SELECT state,immutable_key AS key FROM treido.media_assets WHERE seller_id=$1 AND id=$2 FOR UPDATE`,
          [asset.sellerId, asset.id],
        )
      ).rows[0];
      if (current?.state !== "processing" || current.key !== asset.immutableKey)
        throw new SellerError("FORBIDDEN");
    },
    apply: async (tx) => {
      await tx.client.query(
        `UPDATE treido.media_assets SET state='ready',derivative_key=$2,derivative_checksum=$3,
      width=$4,height=$5,error_code=NULL,revision=revision+1 WHERE id=$1`,
        [asset.id, key, processed.checksum, processed.width, processed.height],
      );
    },
  };
}
export async function readOwnedMedia(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
  assetId: string,
) {
  if (!validId(assetId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, sellerId, "listing.read");
    const asset = (
      await tx.client.query<Asset>(
        `SELECT ${columns} FROM treido.media_assets WHERE seller_id=$1 AND id=$2 AND state='ready'`,
        [sellerId, assetId],
      )
    ).rows[0];
    if (!asset || !asset.derivativeKey || !asset.derivativeChecksum)
      throw new SellerError("NOT_FOUND");
    await ownedDraft(tx, sellerId, asset.listingId, false);
    return { key: asset.derivativeKey, checksum: asset.derivativeChecksum };
  });
}
