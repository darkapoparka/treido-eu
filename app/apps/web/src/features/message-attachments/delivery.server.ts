import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeConversation } from "../messaging/conversation-access.server";
import {
  caseStorageReady,
  messageHiddenSql,
} from "../trust/case-storage.server";
import { SellerError } from "../sellers/errors";
import { assetInput, ATTACHMENT_LIMITS as L } from "./model";
import { assetRow, requireObject, storageMatches } from "./commands.server";
import {
  requireAttachmentStorage,
  type AttachmentStorage,
} from "./storage.server";
import { checksumOf } from "./raster.server";
export async function deliverAttachment(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
  storage: AttachmentStorage = requireAttachmentStorage(),
) {
  const data = assetInput(raw);
  const permitted = () =>
    inTransaction(database, async (tx) => {
      const { user } = await authorizeConversation(
        tx,
        identity,
        data.threadId,
        false,
        { sellerId: data.sellerId },
      );
      const asset = await assetRow(tx, data.id, data.threadId);
      storageMatches(asset, storage);
      if (
        asset.state !== "ready" ||
        !asset.readyChecksum ||
        !asset.readyBytes ||
        !asset.width ||
        !asset.height
      )
        throw new SellerError("NOT_FOUND");
      const hidden = messageHiddenSql(await caseStorageReady(tx));
      const links = await tx.client.query(
        `SELECT m.id FROM treido.message_attachment_links link JOIN treido.messages m ON m.id=link.message_id AND m.thread_id=link.thread_id WHERE link.attachment_id=$1 AND link.thread_id=$2 AND NOT(${hidden})`,
        [asset.id, asset.threadId],
      );
      // Only the uploader may preview an unbound, unexpired file.
      if (!links.rowCount) {
        const anyLink = (
          await tx.client.query(
            "SELECT attachment_id FROM treido.message_attachment_links WHERE attachment_id=$1",
            [asset.id],
          )
        ).rowCount;
        if (
          anyLink ||
          asset.createdBy !== user.id ||
          asset.operatingSellerId !== data.sellerId ||
          asset.expired
        )
          throw new SellerError("NOT_FOUND");
      }
      await requireObject(tx, asset, asset.objectKey);
      return asset;
    });
  const accepted = await permitted();
  const bytes = await storage.read(accepted.objectKey, L.bytes);
  if (
    bytes.length !== accepted.readyBytes ||
    checksumOf(bytes) !== accepted.readyChecksum
  )
    throw new SellerError("NOT_AVAILABLE");
  const current = await permitted();
  if (
    current.revision !== accepted.revision ||
    current.objectKey !== accepted.objectKey ||
    current.readyChecksum !== accepted.readyChecksum
  )
    throw new SellerError("NOT_FOUND");
  return bytes;
}
