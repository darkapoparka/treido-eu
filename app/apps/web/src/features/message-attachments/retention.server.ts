import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import { assetRow, storageMatches } from "./commands.server";
import type { AttachmentStorage } from "./storage.server";
/** Bounded retry sweep; no listing registry/bucket enumeration. Linked images remain immutable and live. */
export async function purgeAttachmentObjects(
  database: SellerDatabase,
  storage: AttachmentStorage,
  attachmentId?: string,
) {
  const candidates = (
    await database.pool.query<{ key: string; id: string }>(
      `SELECT object_key AS key,attachment_id AS id FROM treido.message_attachment_objects o WHERE storage_scope=$1 AND ($2::uuid IS NULL OR attachment_id=$2) AND state<>'deleted' AND write_until<clock_timestamp() AND retain_until<=clock_timestamp() AND (deletion_until IS NULL OR deletion_until<clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM treido.message_attachments a WHERE a.id=o.attachment_id AND
  ((o.kind='ready' AND a.object_key=o.object_key AND EXISTS(SELECT 1 FROM treido.message_attachment_links l WHERE l.attachment_id=a.id)) OR
   (o.kind='source' AND a.source_key=o.object_key AND a.state='processing' AND a.expires_at>clock_timestamp())))
 ORDER BY retain_until,object_key LIMIT 10`,
      [storage.scope, attachmentId ?? null],
    )
  ).rows;
  const result = { deleted: 0, pending: 0 };
  for (const candidate of candidates) {
    const token = await inTransaction(database, async (tx) => {
      const asset = await assetRow(tx, candidate.id);
      storageMatches(asset, storage);
      const object = (
        await tx.client.query<{ kind: string }>(
          `SELECT kind FROM treido.message_attachment_objects WHERE storage_scope=$1 AND object_key=$2 AND state<>'deleted' AND write_until<clock_timestamp() AND retain_until<=clock_timestamp() AND (deletion_until IS NULL OR deletion_until<clock_timestamp()) FOR UPDATE`,
          [storage.scope, candidate.key],
        )
      ).rows[0];
      if (!object) return null;
      const linked = (
        await tx.client.query(
          "SELECT attachment_id FROM treido.message_attachment_links WHERE attachment_id=$1",
          [asset.id],
        )
      ).rowCount;
      // Sources in active processing and completed-message ready bytes cannot be orphaned.
      if (
        (object.kind === "ready" &&
          asset.objectKey === candidate.key &&
          linked) ||
        (object.kind === "source" &&
          asset.sourceKey === candidate.key &&
          asset.state === "processing" &&
          !asset.expired)
      )
        return null;
      if (asset.expired && !linked && asset.state !== "removed")
        await tx.client.query(
          "UPDATE treido.message_attachments SET state='removed',revision=revision+1 WHERE id=$1",
          [asset.id],
        );
      if (
        object.kind === "ready" &&
        asset.objectKey === candidate.key &&
        asset.state !== "removed"
      )
        return null;
      const token = randomUUID();
      await tx.client.query(
        "UPDATE treido.message_attachment_objects SET state='deleting',deletion_token=$3,deletion_until=clock_timestamp()+interval '2 minutes' WHERE storage_scope=$1 AND object_key=$2",
        [storage.scope, candidate.key, token],
      );
      return token;
    });
    if (!token) continue;
    try {
      await storage.remove(candidate.key);
    } catch {
      result.pending++;
      continue;
    }
    const written = await database.pool.query(
      "UPDATE treido.message_attachment_objects SET state='deleted',deletion_token=NULL,deletion_until=NULL,deleted_at=clock_timestamp() WHERE storage_scope=$1 AND object_key=$2 AND state='deleting' AND deletion_token=$3",
      [storage.scope, candidate.key, token],
    );
    if (written.rowCount) result.deleted++;
  }
  return result;
}
