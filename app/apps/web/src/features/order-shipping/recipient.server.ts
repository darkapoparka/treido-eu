import "server-only";
import type { PoolClient } from "pg";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { orderContext } from "../order-aftercare/storage.server";
import type { Scope } from "../order-aftercare/model";
import { acceptedFinancialPolicy } from "../order-aftercare/policy.server";
import { ownedShippingRow, ownRecipient } from "./storage.server";
import {
  shippingStorageAvailable,
  shippingRetentionReady,
} from "./registry.server";
import { parseRecipient } from "./model";

/** Minimal fulfilment details only after actual confirmed order and current
 * buyer ownership or current specific merchant order.fulfil membership. */
export async function readOrderShippingRecipient(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  scope: Scope,
) {
  return inTransaction(database, async (tx) => {
    const order = await orderContext(
      tx,
      identity,
      scope,
      scope.sellerId ? "order.fulfil" : "order.read",
    );
    if (!(await shippingStorageAvailable(tx)))
      return { available: false } as const;
    const policy = await acceptedFinancialPolicy(tx, order);
    if (
      !policy ||
      policy.method !== "shipping" ||
      order.paymentState !== "paid" ||
      order.terms.handover !== "shipping"
    )
      return { available: false } as const;
    const linked = (
      await tx.client.query<{ id: string }>(
        "SELECT id FROM treido.order_shipping_choices WHERE quote_id=$1 AND buyer_id=$2 AND seller_id=$3 AND state='bound'",
        [order.quoteId, order.buyerId, order.sellerId],
      )
    ).rows[0];
    if (!linked) return { available: false } as const;
    const row = await ownedShippingRow(tx, order.buyerId, linked.id);
    const p = row.snapshot.option.policy;
    const current = (
      await tx.client.query(
        "SELECT id FROM treido.order_shipping_policies WHERE id=$1 AND terms_hash=$2 AND platform_account=$3 AND livemode=$4 AND environment=$5 AND application_id=$6 AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE",
        [
          p.id,
          p.termsHash,
          order.platformAccount,
          order.livemode,
          order.environment,
          order.applicationId,
        ],
      )
    ).rows[0];
    if (!current || !(await shippingRetentionReady(tx, p)))
      return { available: false } as const;
    const shipping = order.terms.shipping;
    if (
      !shipping ||
      typeof shipping !== "object" ||
      inputHash((shipping as { choice?: unknown }).choice) !==
        inputHash({
          id: row.id,
          revision: row.revision - 1,
          snapshotHash: row.snapshotHash,
          acknowledged: true,
        })
    )
      throw new SellerError("NOT_AVAILABLE");
    const privateValue = await ownRecipient(tx, row);
    if (!privateValue.value) return { available: false } as const;
    return {
      available: true,
      recipient: parseRecipient(privateValue.value, p.fields, p.requiredFields),
      purpose: p.recipientPurpose[row.snapshot.language],
      retention: p.retentionDescription[row.snapshot.language],
      country: row.snapshot.country,
      method: row.snapshot.option.binding.method,
      carrier: row.snapshot.option.binding.carrierLabel[row.snapshot.language],
    } as const;
  });
}
export type ShippingOwnExport = {
  choices: {
    id: string;
    state: string;
    language: string;
    totalMinor: number;
    currency: "EUR";
    createdAt: string;
  }[];
  more: boolean;
};
/** Root's EXISTING personal export supplies its already-authorized human ID.
 * Recipient raw values may belong to a third person and are deliberately absent. */
export async function readShippingOwnExport(
  client: Pick<PoolClient, "query">,
  userId: string,
): Promise<ShippingOwnExport> {
  if (!validId(userId)) throw new SellerError("INVALID_INPUT");
  const present = (
    await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM unnest(ARRAY['order_shipping_choices','order_shipping_recipients']) name WHERE to_regclass('treido.'||name) IS NOT NULL",
    )
  ).rows[0];
  if (present?.n !== 2) throw new SellerError("NOT_AVAILABLE");
  const rows = (
    await client.query<{
      id: string;
      state: string;
      language: string;
      totalMinor: number;
      createdAt: Date;
    }>(
      "SELECT id,state,snapshot->>'language' AS language,(snapshot->'option'->'costs'->>'totalMinor')::integer AS \"totalMinor\",created_at AS \"createdAt\" FROM treido.order_shipping_choices WHERE buyer_id=$1 ORDER BY created_at DESC,id DESC LIMIT 51",
      [userId],
    )
  ).rows;
  return {
    choices: rows.slice(0, 50).map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      currency: "EUR",
    })),
    more: rows.length > 50,
  };
}
