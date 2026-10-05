import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { inventoryAccess, reservedSql } from "./queries.server";
import {
  parseInventoryCommand,
  type InventoryAcknowledgement,
  type InventoryMode,
  type VariantOptions,
} from "./model";
const optionKey = (options: VariantOptions) =>
  inputHash(
    Object.fromEntries(
      Object.entries(options).map(([key, value]) => [
        key.toLowerCase(),
        value.toLowerCase(),
      ]),
    ),
  );
export async function stockEvent(
  tx: SellerTransaction,
  input: {
    sellerId: string;
    listingId: string;
    skuId: string;
    actorId?: string | null;
    allocationId?: string | null;
    kind: string;
    quantity: number;
    onHand: number;
    reason: string;
  },
) {
  await tx.client.query(
    "INSERT INTO treido.inventory_events(id,seller_id,listing_id,sku_id,actor_id,allocation_id,kind,quantity,on_hand_after,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [
      randomUUID(),
      input.sellerId,
      input.listingId,
      input.skuId,
      input.actorId ?? null,
      input.allocationId ?? null,
      input.kind,
      input.quantity,
      input.onHand,
      input.reason,
    ],
  );
}
export async function changeInventory(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<InventoryAcknowledgement> {
  try {
    return await inTransaction(database, (tx) =>
      changeInventoryInTransaction(tx, identity, raw),
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    )
      throw new SellerError("CONFLICT");
    throw error;
  }
}

/** Reused by the importer so draft, stock, row result and external ID commit together. */
export async function changeInventoryInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<InventoryAcknowledgement> {
  const command = parseInventoryCommand(raw),
    { sellerId, listingId, operation: op } = command;
  const access = await inventoryAccess(tx, identity, sellerId, listingId, true);
  const catalogue = (
    await tx.client.query<{ mode: InventoryMode; revision: number }>(
      "SELECT mode,revision FROM treido.inventory_catalogues WHERE seller_id=$1 AND listing_id=$2 FOR UPDATE",
      [sellerId, listingId],
    )
  ).rows[0];
  const hash = inputHash(command);
  const prior = (
    await tx.client.query<{
      hash: string;
      result: InventoryAcknowledgement;
    }>(
      "SELECT input_hash AS hash,result FROM treido.inventory_command_receipts WHERE seller_id=$1 AND listing_id=$2 AND actor_id=$3 AND request_id=$4",
      [sellerId, listingId, access.user.id, command.requestId],
    )
  ).rows[0];
  if (prior) {
    if (
      prior.hash !== hash ||
      prior.result.revision !== catalogue?.revision ||
      prior.result.listingRevision !== access.listing.revision
    )
      throw new SellerError("CONFLICT");
    return prior.result;
  }
  if ((catalogue?.revision ?? 0) !== command.expectedRevision)
    throw new SellerError("CONFLICT");
  if (op.kind !== "stock" && access.listing.publication === "published")
    throw new SellerError("CONFLICT");
  const rows = (
    await tx.client.query<{
      id: string;
      options: VariantOptions;
      onHand: number;
      reserved: number;
    }>(
      `SELECT i.id,i.options,i.on_hand AS "onHand",${reservedSql("i.id")} AS reserved FROM treido.inventory_skus i WHERE i.seller_id=$1 AND i.listing_id=$2 AND i.active ORDER BY i.id FOR UPDATE OF i`,
      [sellerId, listingId],
    )
  ).rows;
  let skuId: string;
  if (op.kind === "setup") {
    if (catalogue) throw new SellerError("CONFLICT");
    if (op.mode === "stocked" && access.seller.kind !== "business")
      throw new SellerError("FORBIDDEN");
    skuId = randomUUID();
    await tx.client.query(
      "INSERT INTO treido.inventory_catalogues(seller_id,listing_id,seller_kind,mode) VALUES($1,$2,$3,$4)",
      [sellerId, listingId, access.seller.kind, op.mode],
    );
    await tx.client.query(
      "INSERT INTO treido.inventory_skus(id,seller_id,listing_id,mode,seller_sku,options,option_key,on_hand) VALUES($1,$2,$3,$4,$5,'{}',$6,$7)",
      [
        skuId,
        sellerId,
        listingId,
        op.mode,
        op.sellerSku,
        optionKey({}),
        op.onHand,
      ],
    );
    await stockEvent(tx, {
      sellerId,
      listingId,
      skuId,
      actorId: access.user.id,
      kind: "setup",
      quantity: op.onHand,
      onHand: op.onHand,
      reason: "initial_inventory",
    });
  } else {
    if (!catalogue) throw new SellerError("CONFLICT");
    skuId =
      op.kind === "variant" && op.skuId === null ? randomUUID() : op.skuId!;
    const current = rows.find((row) => row.id === skuId);
    if (!(op.kind === "variant" && op.skuId === null) && !current)
      throw new SellerError("NOT_FOUND");
    if (op.kind === "stock") {
      if (
        op.onHand < current!.reserved ||
        (catalogue.mode === "unique" && op.onHand > 1)
      )
        throw new SellerError("CONFLICT");
      const delta = op.onHand - current!.onHand;
      if (
        (op.reasonKind === "reported_sale" && delta >= 0) ||
        (op.reasonKind === "restock" && delta <= 0)
      )
        throw new SellerError("INVALID_INPUT");
      await tx.client.query(
        "UPDATE treido.inventory_skus SET on_hand=$2,sold=sold+$3,revision=revision+1 WHERE id=$1",
        [skuId, op.onHand, op.reasonKind === "reported_sale" ? -delta : 0],
      );
      await stockEvent(tx, {
        sellerId,
        listingId,
        skuId,
        actorId: access.user.id,
        kind: op.reasonKind,
        quantity: delta,
        onHand: op.onHand,
        reason: op.reason,
      });
    } else if (op.kind === "archive") {
      if (current!.reserved > 0 || rows.length <= 1)
        throw new SellerError("CONFLICT");
      await tx.client.query(
        "UPDATE treido.inventory_skus SET active=false,revision=revision+1 WHERE id=$1",
        [skuId],
      );
    } else {
      if (
        current?.reserved ||
        (catalogue.mode === "unique" &&
          (Object.keys(op.options).length || op.skuId === null)) ||
        (op.skuId === null && rows.length >= access.limits.variants)
      )
        throw new SellerError("CONFLICT");
      const keys = (value: VariantOptions) =>
        Object.keys(value)
          .map((key) => key.toLowerCase())
          .sort()
          .join("\u0000");
      if (
        rows.some(
          (row) => row.id !== skuId && keys(row.options) !== keys(op.options),
        )
      )
        throw new SellerError("INVALID_INPUT");
      if (op.skuId === null) {
        await tx.client.query(
          "INSERT INTO treido.inventory_skus(id,seller_id,listing_id,mode,seller_sku,options,option_key,price_minor,on_hand) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [
            skuId,
            sellerId,
            listingId,
            catalogue.mode,
            op.sellerSku,
            JSON.stringify(op.options),
            optionKey(op.options),
            op.priceMinor,
            op.onHand,
          ],
        );
        await stockEvent(tx, {
          sellerId,
          listingId,
          skuId,
          actorId: access.user.id,
          kind: "setup",
          quantity: op.onHand!,
          onHand: op.onHand!,
          reason: "new_variant",
        });
      } else
        await tx.client.query(
          "UPDATE treido.inventory_skus SET seller_sku=$2,options=$3,option_key=$4,price_minor=$5,revision=revision+1 WHERE id=$1",
          [
            skuId,
            op.sellerSku,
            JSON.stringify(op.options),
            optionKey(op.options),
            op.priceMinor,
          ],
        );
    }
    await tx.client.query(
      "UPDATE treido.inventory_catalogues SET revision=revision+1 WHERE seller_id=$1 AND listing_id=$2",
      [sellerId, listingId],
    );
  }
  // Definition changes invalidate an already-open publication review and draft editor.
  let listingRevision = access.listing.revision;
  if (op.kind !== "stock") {
    listingRevision++;
    await tx.client.query(
      "UPDATE treido.listings SET revision=$3 WHERE seller_id=$1 AND id=$2",
      [sellerId, listingId, listingRevision],
    );
    await tx.client.query(
      "UPDATE treido.listing_drafts SET revision=$3,updated_at=clock_timestamp() WHERE seller_id=$1 AND listing_id=$2",
      [sellerId, listingId, listingRevision],
    );
  }
  const result = {
    revision: (catalogue?.revision ?? 0) + 1,
    skuId,
    listingRevision,
  };
  await tx.client.query(
    "INSERT INTO treido.inventory_command_receipts(seller_id,listing_id,actor_id,request_id,input_hash,result) VALUES($1,$2,$3,$4,$5,$6)",
    [
      sellerId,
      listingId,
      access.user.id,
      command.requestId,
      hash,
      JSON.stringify(result),
    ],
  );
  return result;
}
