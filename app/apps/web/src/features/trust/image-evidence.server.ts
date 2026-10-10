import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeOperator } from "./reports.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { assetRow, requireObject, storageMatches } from "../message-attachments/commands.server";
import { imageTombstoned } from "../message-attachments/lifecycle-access.server";
import { requireAttachmentStorage, type AttachmentStorage } from "../message-attachments/storage.server";
import { checksumOf } from "../message-attachments/raster.server";
import { ATTACHMENT_LIMITS } from "../message-attachments/model";

export type ReportImageEvidence = {id: string; width: number | null; height: number | null; state: "available" | "removed" | "deletion-in-flight" | "unavailable"};
export async function readReportImageEvidence(database: SellerDatabase, identity: VerifiedIdentity, reportId: string): Promise<ReportImageEvidence[]> {
  if (!validId(reportId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async tx => {
    await authorizeOperator(tx, identity, "reports.read");
    const report = (await tx.client.query<{kind: string; resourceId: string}>(
      'SELECT resource_kind AS kind,resource_id AS "resourceId" FROM treido.reports WHERE id=$1 FOR SHARE', [reportId],
    )).rows[0];
    if (!report) throw new SellerError("NOT_FOUND");
    if (report.kind !== "message") return [];
    return (await tx.client.query<ReportImageEvidence>(
      `SELECT a.id,a.width,a.height,CASE WHEN o.state='deleted' THEN 'removed'
       WHEN EXISTS(SELECT 1 FROM treido.message_image_tombstones x WHERE x.attachment_id=a.id) OR o.state='deleting' THEN 'deletion-in-flight'
       WHEN a.state='ready' AND o.state='tracked' AND a.ready_checksum IS NOT NULL AND a.ready_bytes>0 THEN 'available' ELSE 'unavailable' END AS state
       FROM treido.messages m JOIN treido.message_attachment_links l ON l.message_id=m.id AND l.thread_id=m.thread_id
       JOIN treido.message_attachments a ON a.id=l.attachment_id AND a.thread_id=m.thread_id
       LEFT JOIN treido.message_attachment_objects o ON o.attachment_id=a.id AND o.storage_scope=a.storage_scope AND o.object_key=a.object_key
       WHERE m.id=$1 ORDER BY a.id LIMIT 4`, [report.resourceId],
    )).rows;
  });
}
/** Grant and exact report/image ownership are checked both before and after storage I/O.
 * Even an operator may not turn an unrelated report into access to another conversation. */
export async function deliverReportImage(database: SellerDatabase, identity: VerifiedIdentity, reportId: string, attachmentId: string, suppliedStorage?: AttachmentStorage) {
  if (!validId(reportId) || !validId(attachmentId)) throw new SellerError("INVALID_INPUT");
  let storage = suppliedStorage;
  const permitted = (accepted?: {revision: number; objectKey: string; readyChecksum: string | null}) => inTransaction(database, async tx => {
    const operator = await authorizeOperator(tx, identity, "reports.read");
    const link = (await tx.client.query<{threadId: string}>(
      `SELECT m.thread_id AS "threadId" FROM treido.reports r JOIN treido.messages m ON r.resource_kind='message' AND r.resource_id=m.id
       JOIN treido.message_attachment_links l ON l.message_id=m.id AND l.thread_id=m.thread_id AND l.attachment_id=$2
       WHERE r.id=$1 FOR SHARE OF r`, [reportId, attachmentId],
    )).rows[0];
    if (!link) throw new SellerError("NOT_FOUND");
    const asset = await assetRow(tx, attachmentId, link.threadId);
    if (await imageTombstoned(tx, asset.id)) throw new SellerError("NOT_FOUND");
    if (asset.state !== "ready" || !asset.readyChecksum || !asset.readyBytes || !asset.width || !asset.height) throw new SellerError("NOT_FOUND");
    storage ??= requireAttachmentStorage();
    storageMatches(asset, storage);
    await requireObject(tx, asset, asset.objectKey);
    if (accepted) {
      if (asset.revision !== accepted.revision || asset.objectKey !== accepted.objectKey || asset.readyChecksum !== accepted.readyChecksum) throw new SellerError("NOT_FOUND");
      await tx.client.query(
        "INSERT INTO treido.report_image_accesses(id,operator_id,report_id,attachment_id,attachment_revision,checksum) VALUES($1,$2,$3,$4,$5,$6)",
        [randomUUID(),operator.id,reportId,asset.id,asset.revision,asset.readyChecksum],
      );
    }
    return asset;
  });
  const accepted = await permitted();
  const bytes = await storage!.read(accepted.objectKey, ATTACHMENT_LIMITS.bytes);
  if (bytes.length !== accepted.readyBytes || checksumOf(bytes) !== accepted.readyChecksum) throw new SellerError("NOT_AVAILABLE");
  await permitted(accepted);
  return bytes;
}
