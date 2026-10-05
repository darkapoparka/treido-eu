import "server-only";
import type { SellerTransaction } from "../../server/db/database";
export async function imageTombstoned(tx: SellerTransaction, id: string) {
  const ready = (
    await tx.client.query<{ ready: boolean }>(
      "SELECT to_regclass('treido.message_image_tombstones') IS NOT NULL AS ready",
    )
  ).rows[0]?.ready;
  return !!(
    ready &&
    (
      await tx.client.query(
        "SELECT attachment_id FROM treido.message_image_tombstones WHERE attachment_id=$1",
        [id],
      )
    ).rowCount
  );
}
