import "server-only";
import type { SellerTransaction } from "../../server/db/database";
/** Optional shared consumer readiness only. A database/metadata failure is never treated as approval or success. */
export async function promotionStorageReady(
  tx: SellerTransaction,
): Promise<boolean> {
  const row = (
    await tx.client.query<{ ready: boolean }>(
      `SELECT to_regclass('treido.promotion_attempts') IS NOT NULL AND to_regclass('treido.promotion_provider_signals') IS NOT NULL AND to_regclass('treido.promotion_provider_events') IS NOT NULL AND to_regclass('treido.promotion_checkout_intents') IS NOT NULL AND to_regclass('treido.promotion_payment_bindings') IS NOT NULL AND to_regclass('treido.promotion_customer_bindings') IS NOT NULL AS ready`,
    )
  ).rows[0];
  return row?.ready === true;
}
