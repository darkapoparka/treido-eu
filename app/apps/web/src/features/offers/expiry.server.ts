import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import { releaseAllocation } from "../inventory/allocations.server";
import { whole } from "../inventory/model";
import { SellerError } from "../sellers/errors";
/** Caller holds this thread's UPDATE lock. No synthetic user, message or external delivery. */
export async function expirePendingOffersInTransaction(
  tx: SellerTransaction,
  threadId: string,
) {
  await tx.client.query(
    "UPDATE treido.listing_offers SET state='expired',revision=revision+1 WHERE thread_id=$1 AND state='pending' AND expires_at<=clock_timestamp()",
    [threadId],
  );
  const rows = (
    await tx.client.query<{ id: string }>(
      "SELECT o.id FROM treido.listing_offers o WHERE o.thread_id=$1 AND o.state='expired' AND NOT EXISTS(SELECT 1 FROM treido.offer_events e WHERE e.offer_id=o.id AND e.kind='expired') ORDER BY o.id",
      [threadId],
    )
  ).rows;
  for (const row of rows)
    await tx.client.query(
      "INSERT INTO treido.offer_events(id,thread_id,offer_id,actor_id,kind) VALUES($1,$2,$3,NULL,'expired') ON CONFLICT DO NOTHING",
      [randomUUID(), threadId, row.id],
    );
  return rows.length;
}
/** Server-only timer reconciliation; acceptance and settlement retain their original history. */
export async function expireOffers(database: SellerDatabase, limit = 50) {
  if (!whole(limit, 1, 100)) throw new SellerError("INVALID_INPUT");
  const candidates = (
    await database.pool.query<{ id: string }>(
      "SELECT DISTINCT o.thread_id AS id FROM treido.listing_offers o LEFT JOIN treido.inventory_allocations a ON a.id=o.allocation_id WHERE ((o.state='pending' AND o.expires_at<=clock_timestamp()) OR (o.state='expired' AND NOT EXISTS(SELECT 1 FROM treido.offer_events e WHERE e.offer_id=o.id AND e.kind='expired')) OR (o.state='accepted' AND (a.state='expired' OR (a.state='active' AND a.expires_at<=clock_timestamp())) AND NOT EXISTS(SELECT 1 FROM treido.offer_events e WHERE e.offer_id=o.id AND e.kind='hold_expired'))) ORDER BY o.thread_id LIMIT $1",
      [limit],
    )
  ).rows;
  let events = 0;
  for (const candidate of candidates)
    events += await inTransaction(database, async (tx) => {
      const scope = (
        await tx.client.query<{ sellerId: string; listingId: string }>(
          'SELECT seller_id AS "sellerId",listing_id AS "listingId" FROM treido.conversation_threads WHERE id=$1',
          [candidate.id],
        )
      ).rows[0];
      if (!scope) return 0;
      await tx.client.query(
        "SELECT id FROM treido.seller_accounts WHERE id=$1 FOR SHARE",
        [scope.sellerId],
      );
      await tx.client.query(
        "SELECT id FROM treido.listings WHERE id=$1 AND seller_id=$2 FOR UPDATE",
        [scope.listingId, scope.sellerId],
      );
      await tx.client.query(
        "SELECT id FROM treido.conversation_threads WHERE id=$1 FOR UPDATE",
        [candidate.id],
      );
      let changed = await expirePendingOffersInTransaction(tx, candidate.id);
      const holds = (
        await tx.client.query<{ id: string; allocation: string }>(
          "SELECT o.id,o.allocation_id AS allocation FROM treido.listing_offers o JOIN treido.inventory_allocations a ON a.id=o.allocation_id WHERE o.thread_id=$1 AND o.state='accepted' AND (a.state='expired' OR (a.state='active' AND a.expires_at<=clock_timestamp())) AND NOT EXISTS(SELECT 1 FROM treido.offer_events e WHERE e.offer_id=o.id AND e.kind='hold_expired') ORDER BY o.id FOR UPDATE OF o",
          [candidate.id],
        )
      ).rows;
      for (const hold of holds) {
        const allocation = await releaseAllocation(
          tx,
          hold.allocation,
          null,
          "expired",
        );
        if (allocation.state !== "expired") continue;
        const inserted = await tx.client.query(
          "INSERT INTO treido.offer_events(id,thread_id,offer_id,actor_id,kind) VALUES($1,$2,$3,NULL,'hold_expired') ON CONFLICT DO NOTHING",
          [randomUUID(), candidate.id, hold.id],
        );
        changed += inserted.rowCount ?? 0;
      }
      if (changed)
        await tx.client.query(
          "UPDATE treido.conversation_threads SET offer_revision=offer_revision+1 WHERE id=$1",
          [candidate.id],
        );
      return changed;
    });
  return { examined: candidates.length, events };
}
