import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { inventoryAccess } from "./queries.server";
import { changeInventoryInTransaction } from "./commands.server";
import { parseStockBatch, type StockBatchResult } from "./batch-model";
/** Every explicit row succeeds together or the entire adjustment rolls back. */
export async function changeStockBatch(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<StockBatchResult> {
  const command = parseStockBatch(raw),
    hash = inputHash(command);
  return inTransaction(database, async (tx) => {
    const contexts = new Map<
      string,
      Awaited<ReturnType<typeof inventoryAccess>>
    >();
    for (const listingId of [
      ...new Set(command.lines.map((line) => line.listingId)),
    ]) {
      contexts.set(
        listingId,
        await inventoryAccess(tx, identity, command.sellerId, listingId, true),
      );
    }
    const actorId = contexts.values().next().value!.user.id;
    const prior = (
      await tx.client.query<{ hash: string; result: StockBatchResult }>(
        "SELECT input_hash AS hash,result FROM treido.inventory_batch_receipts WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3",
        [command.sellerId, actorId, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.hash !== hash) throw new SellerError("CONFLICT");
      const current = (
        await tx.client.query<{ id: string; revision: number }>(
          "SELECT listing_id AS id,revision FROM treido.inventory_catalogues WHERE seller_id=$1 AND listing_id=ANY($2::uuid[])",
          [command.sellerId, [...contexts.keys()]],
        )
      ).rows;
      if (
        prior.result.lines.some(
          (line) =>
            current.find((row) => row.id === line.listingId)?.revision !==
              line.revision ||
            contexts.get(line.listingId)?.listing.revision !==
              line.listingRevision,
        )
      )
        throw new SellerError("CONFLICT");
      return prior.result;
    }
    const revisions = new Map<string, number>();
    const result: StockBatchResult = { lines: [] };
    for (const line of command.lines) {
      const changed = await changeInventoryInTransaction(tx, identity, {
        sellerId: command.sellerId,
        listingId: line.listingId,
        requestId: randomUUID(),
        expectedRevision:
          revisions.get(line.listingId) ?? line.expectedRevision,
        operation: {
          kind: "stock",
          skuId: line.skuId,
          onHand: line.onHand,
          reason: command.reason,
          reasonKind: command.reasonKind,
        },
      });
      revisions.set(line.listingId, changed.revision);
      result.lines.push({
        listingId: line.listingId,
        skuId: line.skuId,
        onHand: line.onHand,
        revision: changed.revision,
        listingRevision: changed.listingRevision,
      });
    }
    // A product can have several adjusted variants, all sharing its final revision.
    for (const line of result.lines)
      line.revision = revisions.get(line.listingId)!;
    await tx.client.query(
      "INSERT INTO treido.inventory_batch_receipts(seller_id,actor_id,request_id,input_hash,result) VALUES($1,$2,$3,$4,$5)",
      [
        command.sellerId,
        actorId,
        command.requestId,
        hash,
        JSON.stringify(result),
      ],
    );
    return result;
  });
}
