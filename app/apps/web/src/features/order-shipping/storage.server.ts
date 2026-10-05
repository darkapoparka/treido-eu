import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import {
  shippingStorageAvailable,
  shippingRetentionReady,
} from "./registry.server";
import type { ShippingCommand, Recipient } from "./model";
import type { ShippingSnapshot } from "./view";

export type ShippingRow = {
  id: string;
  buyerId: string;
  sellerId: string;
  revision: number;
  state: "reviewed" | "accepted" | "bound";
  snapshot: ShippingSnapshot;
  snapshotHash: string;
  expiresAt: Date;
  expired: boolean;
  quoteId: string | null;
};
export async function shippingActor(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  actorKey?: string,
) {
  if (actorKey !== undefined && actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  const user = await authorizeHuman(tx, identity, false);
  if (!(await shippingStorageAvailable(tx)))
    throw new SellerError("NOT_AVAILABLE");
  return user;
}
export async function ownedShippingRow(
  tx: SellerTransaction,
  buyerId: string,
  id: string,
  lock = false,
) {
  const row = (
    await tx.client.query<ShippingRow>(
      'SELECT id,buyer_id AS "buyerId",seller_id AS "sellerId",revision,state,snapshot,snapshot_hash AS "snapshotHash",expires_at AS "expiresAt",expires_at<=clock_timestamp() AS expired,quote_id AS "quoteId" FROM treido.order_shipping_choices WHERE id=$1 AND buyer_id=$2' +
        (lock ? " FOR UPDATE" : ""),
      [id, buyerId],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  if (
    row.snapshotHash !== inputHash(row.snapshot) ||
    row.snapshot.sellerId !== row.sellerId
  )
    throw new SellerError("NOT_AVAILABLE");
  return row;
}
export async function ownRecipient(
  tx: SellerTransaction,
  row: ShippingRow,
): Promise<{ value: Recipient | null; expiresAt: Date | null }> {
  const p = row.snapshot.option.policy;
  const current = (
    await tx.client.query(
      "SELECT id FROM treido.order_shipping_policies WHERE id=$1 AND terms_hash=$2 AND platform_account=$3 AND livemode=$4 AND environment=$5 AND application_id=$6 AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE",
      [
        p.id,
        p.termsHash,
        p.platformAccount,
        p.livemode,
        p.environment,
        p.applicationId,
      ],
    )
  ).rows[0];
  if (!current || !(await shippingRetentionReady(tx, p)))
    return { value: null, expiresAt: null };
  const result = (
    await tx.client.query<{ value: Recipient | null; expiresAt: Date }>(
      'SELECT CASE WHEN retain_until>clock_timestamp() THEN value ELSE NULL END AS value,retain_until AS "expiresAt" FROM treido.order_shipping_recipients WHERE choice_id=$1 AND buyer_id=$2',
      [row.id, row.buyerId],
    )
  ).rows[0];
  return result ?? { value: null, expiresAt: null };
}
export async function priorShippingReceipt(
  tx: SellerTransaction,
  buyerId: string,
  requestId: string,
  command?: ShippingCommand,
) {
  const result = (
    await tx.client.query<{ id: string | null; inputHash: string | null }>(
      'SELECT choice_id AS id,input_hash AS "inputHash" FROM treido.order_shipping_receipts WHERE buyer_id=$1 AND request_id=$2',
      [buyerId, requestId],
    )
  ).rows[0];
  if (result && command && result.inputHash !== inputHash(command))
    throw new SellerError("CONFLICT");
  return result;
}
export async function shippingReceipt(
  tx: SellerTransaction,
  buyerId: string,
  command: ShippingCommand,
  id: string,
  revision: number,
) {
  await tx.client.query(
    "INSERT INTO treido.order_shipping_receipts(buyer_id,request_id,choice_id,input_hash,action,accepted_revision) VALUES($1,$2,$3,$4,$5,$6)",
    [
      buyerId,
      command.requestId,
      id,
      inputHash(command),
      command.action,
      revision,
    ],
  );
  return { id, requestId: command.requestId, revision };
}
