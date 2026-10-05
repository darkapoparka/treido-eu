import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import type { GiftBrief, GiftSnapshot } from "./model";
export async function requireGiftStorage(tx: SellerTransaction) {
  const row = (
    await tx.client.query<{ ready: boolean }>(`SELECT
    to_regclass('treido.buyer_gift_workspaces') IS NOT NULL AND
    to_regclass('treido.buyer_gift_observations') IS NOT NULL AND
    to_regclass('treido.buyer_gift_receipts') IS NOT NULL AS ready`)
  ).rows[0];
  if (!row?.ready) throw new SellerError("NOT_AVAILABLE");
}
export type GiftWorkspaceRow = {
  revision: number;
  brief: GiftBrief | null;
  selectedIds: string[];
  nextCursor: string | null;
};
export async function giftWorkspace(
  tx: SellerTransaction,
  userId: string,
  lock = false,
) {
  return (
    await tx.client.query<GiftWorkspaceRow>(
      'SELECT revision,brief,selected_ids AS "selectedIds",next_cursor AS "nextCursor" FROM treido.buyer_gift_workspaces WHERE user_id=$1' +
        (lock ? " FOR UPDATE" : ""),
      [userId],
    )
  ).rows[0];
}
export type GiftObservationRow = {
  position: number;
  snapshot: GiftSnapshot;
  observedAt: Date;
};
export async function giftObservations(tx: SellerTransaction, userId: string) {
  return (
    await tx.client.query<GiftObservationRow>(
      'SELECT position,snapshot,observed_at AS "observedAt" FROM treido.buyer_gift_observations WHERE user_id=$1 ORDER BY position LIMIT 20',
      [userId],
    )
  ).rows;
}
