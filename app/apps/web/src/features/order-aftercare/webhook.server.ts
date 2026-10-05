import "server-only";
import type Stripe from "stripe";
import type { SellerTransaction } from "../../server/db/database";
import type { PaymentBindings } from "../payments/bindings.server";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import { aftercareStorageAvailable } from "./storage.server";
import { enqueueRefundObservation } from "./jobs.server";
function link(value: unknown): string | null {
  if (typeof value === "string" && /^(pi|ch|re)_[A-Za-z0-9]+$/.test(value))
    return value;
  if (value && typeof value === "object" && "id" in value)
    return link(value.id);
  return null;
}
/** Called ONLY after the original raw-body signature/account/mode receipt and deduplication. */
export async function receiveAftercareEvent(
  tx: SellerTransaction,
  event: Stripe.Event,
  binding: PaymentBindings,
  operationKey: string,
) {
  if (!event.type.startsWith("refund.") && !event.type.startsWith("charge."))
    return;
  if (!(await aftercareStorageAvailable(tx))) return;
  const object = event.data.object;
  const metadata = "metadata" in object ? object.metadata : null;
  const original =
    metadata &&
    "aftercare_intent_id" in metadata &&
    validId(metadata.aftercare_intent_id)
      ? metadata.aftercare_intent_id
      : null;
  const objectId = "id" in object ? link(object.id) : null;
  const paymentIntent =
    "payment_intent" in object ? link(object.payment_intent) : null;
  const chargeId = event.type.startsWith("charge.")
    ? objectId
    : "charge" in object
      ? link(object.charge)
      : null;
  const rows = (
    await tx.client.query<{
      id: string;
      sellerId: string;
      platformAccount: string;
      livemode: boolean;
      environment: string;
      applicationId: string;
    }>(
      "SELECT id,seller_id AS \"sellerId\",platform_account AS \"platformAccount\",livemode,environment,application_id AS \"applicationId\" FROM treido.order_refund_intents WHERE platform_account=$1 AND livemode=$2 AND state IN ('creating','pending','reconciling') AND (($3::uuid IS NOT NULL AND id=$3) OR provider_id=$4 OR payment_intent_id=$5 OR charge_id=$6) ORDER BY id LIMIT 31",
      [
        binding.platformAccount,
        binding.livemode,
        original,
        objectId,
        paymentIntent,
        chargeId,
      ],
    )
  ).rows;
  if (rows.length > 30) throw new SellerError("NOT_AVAILABLE");
  for (const row of rows) {
    if (
      row.environment !== binding.environment ||
      row.applicationId !== binding.applicationId
    )
      throw new SellerError("CONFLICT");
    await enqueueRefundObservation(tx, row, operationKey);
  }
}
