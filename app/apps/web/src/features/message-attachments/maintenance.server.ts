import "server-only";
import type { SellerDatabase } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import {
  requireAttachmentStorage,
  type AttachmentStorage,
} from "./storage.server";
import { purgeAttachmentObjects } from "./retention.server";

/** A missed expiry handoff cannot strand registered unbound bytes. No bucket scans. */
export async function maintainMessageAttachments(
  database: SellerDatabase,
  supplied?: AttachmentStorage,
) {
  const schema = await database.pool.query<{ ready: boolean }>(
    "SELECT to_regclass('treido.message_attachment_objects') IS NOT NULL AS ready",
  );
  if (!schema.rows[0]?.ready)
    return { available: false, deleted: 0, pending: 0 };
  let storage: AttachmentStorage;
  try {
    storage = supplied ?? requireAttachmentStorage();
  } catch (error) {
    if (error instanceof SellerError && error.code === "NOT_AVAILABLE")
      return { available: false, deleted: 0, pending: 0 };
    throw error;
  }
  return {
    available: true,
    ...(await purgeAttachmentObjects(database, storage)),
  };
}
