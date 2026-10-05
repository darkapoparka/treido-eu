import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  requireMediaStorage,
  type MediaStorage,
} from "../../server/media/storage.server";
import { processPhoto } from "../../server/media/process.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { INPUT_LIMITS, uuid, type InputMode } from "./model";
import {
  runtimePolicy,
  requirePolicy,
  type RuntimePolicy,
} from "./policy.server";
import {
  ownedInputMedia,
  requireInputConsent,
  requireInputStorage,
  requireInputLifecycle,
  type InputMedia,
} from "./storage.server";
export function inputMediaStorage(policy: RuntimePolicy): MediaStorage {
  if (!policy.config.mediaEnabled || !policy.config.retentionEnabled)
    throw new SellerError("NOT_AVAILABLE");
  const storage = requireMediaStorage();
  if (storage.scope !== policy.config.mediaScope)
    throw new SellerError("NOT_AVAILABLE");
  return storage;
}
export function validateCanonicalWav(bytes: Buffer, maximumSeconds: number) {
  if (
    bytes.length < 46 ||
    bytes.length > INPUT_LIMITS.mediaBytes ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.readUInt32LE(4) !== bytes.length - 8 ||
    bytes.toString("ascii", 8, 12) !== "WAVE" ||
    bytes.toString("ascii", 12, 16) !== "fmt " ||
    bytes.readUInt32LE(16) !== 16 ||
    bytes.readUInt16LE(20) !== 1 ||
    bytes.toString("ascii", 36, 40) !== "data" ||
    bytes.readUInt32LE(40) !== bytes.length - 44
  )
    throw new SellerError("INVALID_INPUT");
  const channels = bytes.readUInt16LE(22),
    rate = bytes.readUInt32LE(24),
    align = bytes.readUInt16LE(32),
    depth = bytes.readUInt16LE(34);
  const duration = (bytes.length - 44) / (rate * align);
  if (
    ![1, 2].includes(channels) ||
    ![16000, 24000, 44100, 48000].includes(rate) ||
    depth !== 16 ||
    align !== channels * 2 ||
    bytes.readUInt32LE(28) !== rate * align ||
    (bytes.length - 44) % align !== 0 ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > maximumSeconds
  )
    throw new SellerError("INVALID_INPUT");
  // Exact PCM header/data only: ancillary metadata chunks are never accepted.
  return {
    duration,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  };
}
export function actualPhotoContentType(bytes: Buffer) {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  throw new SellerError("INVALID_INPUT");
}
export async function registerInputObject(
  tx: SellerTransaction,
  media: Pick<
    InputMedia,
    "id" | "userId" | "scope" | "expiresAt" | "writeUntil"
  >,
  key: string,
  kind: "staging" | "immutable" | "ready",
) {
  // One fixed deadline is accepted at original staging. Later derivatives,
  // retries and cancellation never refresh the original writer window.
  await tx.client.query(
    "INSERT INTO treido.assistant_media_objects(storage_scope,object_key,user_id,asset_id,kind,write_until,retain_until) VALUES($1,$2,$3,$4,$5,$6,$6)",
    [media.scope, key, media.userId, media.id, kind, media.writeUntil],
  );
}
export async function claimMediaValidation(
  tx: SellerTransaction,
  userId: string,
  inputMode: InputMode,
  assetId: string,
) {
  const media = await ownedInputMedia(tx, userId, assetId, true);
  if (media.mode !== inputMode || media.expired || media.state !== "staged")
    throw new SellerError("CONFLICT");
  const policy = requirePolicy(await runtimePolicy(tx, media.policyId));
  await requireInputConsent(tx, userId, inputMode, policy.id);
  const storage = inputMediaStorage(policy),
    immutable = `${storage.prefix}immutable/assistant/${userId}/${assetId}/${randomUUID()}`;
  await tx.client.query(
    "UPDATE treido.assistant_media_assets SET state='validating',immutable_key=$2 WHERE id=$1",
    [assetId, immutable],
  );
  await registerInputObject(tx, media, immutable, "immutable");
}
async function activeMedia(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  assetId: string,
  expectedState: string,
) {
  return inTransaction(database, async (tx) => {
    await requireInputStorage(tx);
    if (expectedState !== "ready") await requireInputLifecycle(tx);
    const user = await authorizeHuman(tx, identity, false),
      media = await ownedInputMedia(tx, user.id, assetId);
    if (media.expired || media.state !== expectedState)
      throw new SellerError("NOT_AVAILABLE");
    if (
      expectedState === "validating" &&
      !(
        await tx.client.query<{ allowed: boolean }>(
          "SELECT expires_at>clock_timestamp()+interval '60 seconds' AS allowed FROM treido.assistant_media_assets WHERE id=$1 AND user_id=$2",
          [assetId, user.id],
        )
      ).rows[0]?.allowed
    )
      throw new SellerError("NOT_AVAILABLE");
    const policy = requirePolicy(await runtimePolicy(tx, media.policyId));
    await requireInputConsent(tx, user.id, media.mode, policy.id);
    return { media, policy };
  });
}
export async function signInputUpload(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  assetId: string,
  freshIdentity: () => Promise<VerifiedIdentity>,
) {
  const { media, policy } = await activeMedia(
      database,
      identity,
      assetId,
      "staged",
    ),
    storage = inputMediaStorage(policy);
  const allowed = await inTransaction(database, async (tx) => {
    await authorizeHuman(tx, identity, false);
    await requireInputConsent(tx, media.userId, media.mode, policy.id);
    return (
      await tx.client.query<{ allowed: boolean }>(
        "SELECT expires_at>clock_timestamp()+interval '5 minutes' AS allowed FROM treido.assistant_media_assets WHERE id=$1 AND user_id=$2 AND state='staged'",
        [assetId, media.userId],
      )
    ).rows[0]?.allowed;
  });
  if (!allowed) throw new SellerError("NOT_AVAILABLE");
  const upload = await storage.upload(media.staging, {
    bytes: media.bytes,
    contentType: media.contentType,
  });
  const fresh = await freshIdentity();
  if (fresh.subject !== identity.subject)
    throw new SellerError("UNAUTHENTICATED");
  await activeMedia(database, fresh, assetId, "staged");
  return upload;
}
/** Original completion identity allocates exactly one immutable destination.
 * A possibly completed attempt is recovered by state/expiry, never a new copy. */
export async function completeInputMedia(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  assetId: string,
  freshIdentity: () => Promise<VerifiedIdentity>,
) {
  let accepted: { userId: string; mode: InputMode; immutable: string } | null =
    null;
  try {
    const { media, policy } = await activeMedia(
        database,
        identity,
        assetId,
        "validating",
      ),
      storage = inputMediaStorage(policy);
    if (!media.immutable) throw new SellerError("NOT_AVAILABLE");
    accepted = {
      userId: media.userId,
      mode: media.mode,
      immutable: media.immutable,
    };
    const head = await storage.head(media.staging);
    if (head.bytes !== media.bytes) throw new SellerError("INVALID_INPUT");
    const fresh = await freshIdentity();
    if (fresh.subject !== identity.subject)
      throw new SellerError("UNAUTHENTICATED");
    await activeMedia(database, fresh, assetId, "validating");
    await storage.freeze(
      media.staging,
      head.etag,
      media.immutable,
      media.checksum,
    );
    const original = await storage.read(media.immutable, media.bytes);
    if (
      original.length !== media.bytes ||
      createHash("sha256").update(original).digest("hex") !== media.checksum
    )
      throw new SellerError("INVALID_INPUT");
    let ready = media.immutable,
      checksum = media.checksum,
      readyBytes = original.length;
    if (media.mode === "voice")
      validateCanonicalWav(original, policy.config.audioSeconds);
    else {
      if (actualPhotoContentType(original) !== media.contentType)
        throw new SellerError("INVALID_INPUT");
      const processed = await processPhoto(original, media.checksum);
      ready = `${storage.prefix}ready/assistant/${media.userId}/${media.id}/${randomUUID()}.webp`;
      checksum = processed.checksum;
      readyBytes = processed.bytes.length;
      const writeIdentity = await freshIdentity();
      if (writeIdentity.subject !== identity.subject)
        throw new SellerError("UNAUTHENTICATED");
      await inTransaction(database, async (tx) => {
        await requireInputLifecycle(tx);
        await authorizeHuman(tx, writeIdentity, false);
        const current = await ownedInputMedia(tx, media.userId, assetId, true);
        if (
          current.expired ||
          current.state !== "validating" ||
          !(
            await tx.client.query<{ allowed: boolean }>(
              "SELECT expires_at>clock_timestamp()+interval '15 seconds' AS allowed FROM treido.assistant_media_assets WHERE id=$1 AND user_id=$2",
              [assetId, media.userId],
            )
          ).rows[0]?.allowed
        )
          throw new SellerError("CONFLICT");
        await requireInputConsent(tx, media.userId, media.mode, policy.id);
        requirePolicy(await runtimePolicy(tx, policy.id));
        await registerInputObject(tx, current, ready, "ready");
      });
      await storage.put(ready, processed.bytes);
    }
    const currentIdentity = await freshIdentity();
    if (currentIdentity.subject !== identity.subject)
      throw new SellerError("UNAUTHENTICATED");
    await inTransaction(database, async (tx) => {
      const user = await authorizeHuman(tx, currentIdentity, false),
        current = await ownedInputMedia(tx, user.id, assetId, true);
      requirePolicy(await runtimePolicy(tx, policy.id));
      await requireInputConsent(tx, user.id, media.mode, policy.id);
      if (
        current.expired ||
        current.state !== "validating" ||
        current.immutable !== media.immutable
      )
        throw new SellerError("CONFLICT");
      await tx.client.query(
        "UPDATE treido.assistant_media_assets SET state='ready',ready_key=$2,ready_checksum=$3,ready_bytes=$4 WHERE id=$1",
        [assetId, ready, checksum, readyBytes],
      );
    });
  } catch (error) {
    if (!accepted) throw error;
    try {
      await inTransaction(database, async (tx) => {
        await tx.client.query(
          "SELECT id FROM treido.users WHERE id=$1 FOR UPDATE",
          [accepted!.userId],
        );
        await tx.client.query(
          "UPDATE treido.assistant_media_assets SET state='unknown' WHERE id=$1 AND user_id=$2 AND mode=$3 AND immutable_key=$4 AND state='validating'",
          [assetId, accepted!.userId, accepted!.mode, accepted!.immutable],
        );
      });
    } catch {
      console.error("Treido assistant media recovery remains pending.");
    }
    throw error;
  }
}
export async function readOwnedInputBytes(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  assetId: string,
) {
  uuid(assetId);
  const { media, policy } = await activeMedia(
      database,
      identity,
      assetId,
      "ready",
    ),
    storage = inputMediaStorage(policy);
  if (!media.ready || !media.readyChecksum || !media.readyBytes)
    throw new SellerError("NOT_AVAILABLE");
  const bytes = await storage.read(media.ready, media.readyBytes);
  if (
    bytes.length !== media.readyBytes ||
    createHash("sha256").update(bytes).digest("hex") !== media.readyChecksum
  )
    throw new SellerError("NOT_AVAILABLE");
  await activeMedia(database, identity, assetId, "ready");
  if (media.mode === "voice")
    validateCanonicalWav(bytes, policy.config.audioSeconds);
  return {
    bytes,
    mediaType:
      media.mode === "photo" ? ("image/webp" as const) : ("audio/wav" as const),
  };
}
export async function assertOwnedInputReadable(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  assetId: string,
) {
  uuid(assetId);
  await activeMedia(database, identity, assetId, "ready");
}
