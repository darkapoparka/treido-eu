import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
/** Retain expired invitations; the same predicate frees capacity even before this repair runs. */
export async function expireTeamInvitations(database: SellerDatabase) {
  const sellers = (
    await database.pool.query<{ sellerId: string }>(
      `SELECT DISTINCT seller_id AS "sellerId" FROM treido.seller_invitations WHERE status='pending' AND expires_at<=clock_timestamp() ORDER BY seller_id LIMIT 20`,
    )
  ).rows;
  let expired = 0;
  for (const seller of sellers)
    expired += await inTransaction(database, async (tx) => {
      await tx.client.query(
        `SELECT id FROM treido.seller_accounts WHERE id=$1 FOR UPDATE`,
        [seller.sellerId],
      );
      const rows = (
        await tx.client.query<{ id: string }>(
          `UPDATE treido.seller_invitations SET status='expired',revision=revision+1 WHERE seller_id=$1 AND status='pending' AND expires_at<=clock_timestamp() RETURNING id`,
          [seller.sellerId],
        )
      ).rows;
      if (rows.length) {
        await tx.client.query(
          `INSERT INTO treido.seller_team_state(seller_id,revision) VALUES($1,1) ON CONFLICT(seller_id) DO UPDATE SET revision=treido.seller_team_state.revision+1`,
          [seller.sellerId],
        );
        await tx.client.query(
          `UPDATE treido.invitation_deliveries SET state='cancelled' WHERE invitation_id=ANY($1::uuid[]) AND state IN ('pending','unavailable')`,
          [rows.map((r) => r.id)],
        );
      }
      return rows.length;
    });
  return { expired };
}
