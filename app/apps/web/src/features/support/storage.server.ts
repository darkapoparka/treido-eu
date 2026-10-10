import "server-only";
import type { SellerDatabase } from "../../server/db/database";
import { SellerError } from "../sellers/errors";

/** An unpersisted signed-in human may have a genuinely empty inbox. That does
 * not make an absent or partially bound support adapter an empty success. */
export async function requireSupportStorage(database: SellerDatabase) {
  const ready = (
    await database.pool.query<{ ready: boolean }>(
      `SELECT count(*)=5 AS ready FROM unnest(ARRAY[
       'support_tickets','support_entries','support_command_receipts',
       'support_read_cursors','support_notifications']) name
       WHERE to_regclass('treido.'||name) IS NOT NULL`,
    )
  ).rows[0]?.ready;
  if (ready !== true) throw new SellerError("NOT_AVAILABLE");
}
