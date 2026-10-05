import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../db/database";
import { SellerError } from "../../features/sellers/errors";
import type { MediaStorage } from "./storage.server";

export const MEDIA_RETENTION = {
  candidateHours: 24,
  readyRawDays: 7,
  writeSeconds: 600,
  batch: 10,
} as const;
type ObjectKind = "staging" | "immutable" | "ready";
type Owner = {
  id: string;
  sellerId: string;
  listingId: string;
  storageScope?: string | null;
};
export function assertMediaStorageScope(
  scope: string | null | undefined,
  storage: MediaStorage,
) {
  if (
    !/^[a-f0-9]{64}$/.test(storage.scope) ||
    (scope && scope !== storage.scope)
  )
    throw new SellerError("NOT_AVAILABLE");
}
/** Called inside the owned media transaction before returning a PUT URL or writing bytes. */
export async function registerMediaObject(
  tx: SellerTransaction,
  storage: MediaStorage,
  owner: Owner,
  kind: ObjectKind,
  key: string,
) {
  assertMediaStorageScope(owner.storageScope, storage);
  const base = `${storage.prefix}${kind}/${owner.sellerId}/${owner.id}`;
  if (
    key.length > 300 ||
    (kind === "staging" ? key !== base : !key.startsWith(base + "/"))
  )
    throw new SellerError("INVALID_INPUT");
  await tx.client.query(
    `INSERT INTO treido.media_storage_objects(storage_scope,object_key,seller_id,listing_id,asset_id,kind,write_until,retain_until)
     VALUES($1,$2,$3,$4,$5,$6,clock_timestamp()+make_interval(secs=>$7),clock_timestamp()+make_interval(hours=>$8))
     ON CONFLICT(storage_scope,object_key) DO NOTHING`,
    [
      storage.scope,
      key,
      owner.sellerId,
      owner.listingId,
      owner.id,
      kind,
      MEDIA_RETENTION.writeSeconds,
      MEDIA_RETENTION.candidateHours,
    ],
  );
  const row = (
    await tx.client.query<{ assetId: string; kind: string; state: string }>(
      `SELECT asset_id AS "assetId",kind,state FROM treido.media_storage_objects WHERE storage_scope=$1 AND object_key=$2 FOR UPDATE`,
      [storage.scope, key],
    )
  ).rows[0];
  if (
    !row ||
    row.assetId !== owner.id ||
    row.kind !== kind ||
    row.state !== "tracked"
  )
    throw new SellerError("CONFLICT");
  await tx.client.query(
    `UPDATE treido.media_storage_objects SET write_until=clock_timestamp()+make_interval(secs=>$3),retain_until=greatest(retain_until,clock_timestamp()+make_interval(hours=>$4)) WHERE storage_scope=$1 AND object_key=$2`,
    [
      storage.scope,
      key,
      MEDIA_RETENTION.writeSeconds,
      MEDIA_RETENTION.candidateHours,
    ],
  );
}
/** The link and this check share a transaction. A purger's tombstone always wins over a late writer. */
export async function requireMediaObjectLease(
  tx: SellerTransaction,
  storage: MediaStorage,
  owner: Owner,
  key: string,
) {
  assertMediaStorageScope(owner.storageScope, storage);
  const result = await tx.client.query(
    `SELECT object_key FROM treido.media_storage_objects WHERE storage_scope=$1 AND object_key=$2 AND seller_id=$3 AND asset_id=$4 AND state='tracked' AND write_until>clock_timestamp() FOR UPDATE`,
    [storage.scope, key, owner.sellerId, owner.id],
  );
  if (result.rowCount !== 1) throw new SellerError("CONFLICT");
}
export async function retainProcessedOriginal(
  tx: SellerTransaction,
  storage: MediaStorage,
  owner: Owner,
  key: string,
) {
  // An older, unbound raw file is not silently adopted into the deletion registry.
  await tx.client.query(
    `UPDATE treido.media_storage_objects SET retain_until=greatest(retain_until,clock_timestamp()+make_interval(days=>$5)) WHERE storage_scope=$1 AND object_key=$2 AND seller_id=$3 AND asset_id=$4 AND state='tracked' AND kind='immutable'`,
    [
      storage.scope,
      key,
      owner.sellerId,
      owner.id,
      MEDIA_RETENTION.readyRawDays,
    ],
  );
}
type Candidate = {
  key: string;
  sellerId: string;
  listingId: string;
  assetId: string;
};
async function claim(
  database: SellerDatabase,
  storage: MediaStorage,
  candidate: Candidate,
) {
  return inTransaction(database, async (tx) => {
    // Service cleanup survives staff revocation. Match the normal seller -> listing -> media lock order.
    await tx.client.query(
      `SELECT id FROM treido.seller_accounts WHERE id=$1 FOR SHARE`,
      [candidate.sellerId],
    );
    const listing = (
      await tx.client.query<{ publication: string; revision: number | null }>(
        `SELECT publication,current_publication_revision AS revision FROM treido.listings WHERE seller_id=$1 AND id=$2 FOR UPDATE`,
        [candidate.sellerId, candidate.listingId],
      )
    ).rows[0];
    const asset = (
      await tx.client.query<{
        state: string;
        staging: string;
        immutable: string | null;
        ready: string | null;
        expired: boolean;
        jobId: string | null;
      }>(
        `SELECT state,staging_key AS staging,immutable_key AS immutable,derivative_key AS ready,expires_at<=clock_timestamp() AS expired,job_id AS "jobId" FROM treido.media_assets WHERE seller_id=$1 AND listing_id=$2 AND id=$3 FOR UPDATE`,
        [candidate.sellerId, candidate.listingId, candidate.assetId],
      )
    ).rows[0];
    const object = (
      await tx.client.query<{ kind: ObjectKind; state: string }>(
        `SELECT kind,state FROM treido.media_storage_objects WHERE storage_scope=$1 AND object_key=$2 AND state<>'deleted' AND write_until<clock_timestamp() AND retain_until<=clock_timestamp() AND available_at<=clock_timestamp() AND (deletion_until IS NULL OR deletion_until<clock_timestamp()) FOR UPDATE`,
        [storage.scope, candidate.key],
      )
    ).rows[0];
    if (!listing || !asset || !object) return null;
    if (object.state === "tracked") {
      if (
        object.kind === "ready" &&
        asset.state === "ready" &&
        asset.ready === candidate.key
      )
        return null;
      if (
        object.kind === "staging" &&
        asset.state === "staged" &&
        !asset.expired
      )
        return null;
      if (
        object.kind === "ready" &&
        asset.ready === candidate.key &&
        listing.publication === "published"
      ) {
        const accepted = await tx.client.query(
          `SELECT asset_id FROM treido.listing_publication_media WHERE seller_id=$1 AND listing_id=$2 AND publication_revision=$3 AND asset_id=$4`,
          [
            candidate.sellerId,
            candidate.listingId,
            listing.revision,
            candidate.assetId,
          ],
        );
        if (accepted.rowCount) return null;
      }
      if (
        object.kind === "immutable" &&
        asset.state === "processing" &&
        asset.immutable === candidate.key
      ) {
        const job = (
          await tx.client.query<{ state: string; running: boolean }>(
            `SELECT j.state,(e.state='running' AND e.execution_until>clock_timestamp()) AS running FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.seller_id=$1 AND j.id=$2`,
            [candidate.sellerId, asset.jobId],
          )
        ).rows[0];
        if (!job || !["dead", "cancelled"].includes(job.state) || job.running)
          return null;
        await tx.client.query(
          `UPDATE treido.media_assets SET state='failed',error_code='processing_unavailable',revision=revision+1 WHERE id=$1`,
          [candidate.assetId],
        );
      }
      if (
        object.kind === "staging" &&
        asset.state === "staged" &&
        asset.expired
      ) {
        await tx.client.query(
          `UPDATE treido.media_assets SET state='failed',error_code='upload_expired',revision=revision+1 WHERE id=$1`,
          [candidate.assetId],
        );
      }
    }
    const token = randomUUID();
    await tx.client.query(
      `UPDATE treido.media_storage_objects SET state='deleting',deletion_token=$3,deletion_until=clock_timestamp()+interval '2 minutes',attempts=attempts+1 WHERE storage_scope=$1 AND object_key=$2`,
      [storage.scope, candidate.key, token],
    );
    return token;
  });
}
/** Only registered keys in this exact provider/bucket/prefix scope are eligible; no bucket enumeration. */
export async function cleanupMediaObjects(
  database: SellerDatabase,
  storage: MediaStorage,
) {
  assertMediaStorageScope(storage.scope, storage);
  const candidates = (
    await database.pool.query<Candidate>(
      `SELECT o.object_key AS key,o.seller_id AS "sellerId",o.listing_id AS "listingId",o.asset_id AS "assetId"
     FROM treido.media_storage_objects o JOIN treido.media_assets a ON a.seller_id=o.seller_id AND a.id=o.asset_id
     LEFT JOIN treido.outbox_jobs j ON j.id=a.job_id AND j.seller_id=a.seller_id
     WHERE o.storage_scope=$1 AND o.state<>'deleted' AND o.write_until<clock_timestamp() AND o.retain_until<=clock_timestamp()
       AND o.available_at<=clock_timestamp() AND (o.deletion_until IS NULL OR o.deletion_until<clock_timestamp())
       AND NOT(o.kind='ready' AND a.state='ready' AND a.derivative_key=o.object_key)
       AND NOT(o.kind='staging' AND a.state='staged' AND a.expires_at>clock_timestamp())
       AND NOT(o.kind='immutable' AND a.state='processing' AND a.immutable_key=o.object_key AND coalesce(j.state,'pending') NOT IN ('dead','cancelled'))
     ORDER BY o.available_at,o.retain_until,o.object_key LIMIT $2`,
      [storage.scope, MEDIA_RETENTION.batch],
    )
  ).rows;
  const result = { deleted: 0, pending: 0, skipped: 0 },
    started = Date.now();
  for (const candidate of candidates) {
    if (Date.now() - started >= 8000) break;
    const token = await claim(database, storage, candidate);
    if (!token) {
      result.skipped++;
      continue;
    }
    try {
      await storage.remove(candidate.key);
    } catch {
      await database.pool.query(
        `UPDATE treido.media_storage_objects SET deletion_token=NULL,deletion_until=NULL,available_at=clock_timestamp()+make_interval(secs=>least(3600,60*attempts)) WHERE storage_scope=$1 AND object_key=$2 AND deletion_token=$3 AND state='deleting'`,
        [storage.scope, candidate.key, token],
      );
      result.pending++;
      continue;
    }
    const confirmed = await database.pool.query(
      `UPDATE treido.media_storage_objects SET state='deleted',deletion_token=NULL,deletion_until=NULL,deleted_at=clock_timestamp() WHERE storage_scope=$1 AND object_key=$2 AND deletion_token=$3 AND state='deleting'`,
      [storage.scope, candidate.key, token],
    );
    if (confirmed.rowCount === 1) result.deleted++;
  }
  return result;
}
