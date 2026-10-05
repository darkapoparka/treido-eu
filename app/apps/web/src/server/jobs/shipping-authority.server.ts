import "server-only";
import type { SellerTransaction, SellerDatabase } from "../db/database";
import { inTransaction } from "../db/database";
import { requireBackendBindings } from "../config/backend-bindings.server";
import { requireJobBindings } from "./config.server";
import { validateJobIntent } from "./model";
import type { ShippingJobRow } from "./outbox.server";
import type { EffectResult } from "./execution.server";
import { expireUnboundShippingInput } from "../../features/order-shipping/lifecycle.server";
/** Narrow current accepted-artifact authority, also when its human is restricted. */
export async function authorizeShippingArtifact(
  tx: SellerTransaction,
  job: ShippingJobRow,
  token?: string,
) {
  validateJobIntent(job);
  const backend = requireBackendBindings(),
    executor = requireJobBindings();
  await tx.client.query(
    "SELECT treido.order_shipping_authorize_job($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
    [
      job.id,
      job.buyerId,
      job.resourceId,
      job.kind,
      job.generation,
      token ?? null,
      executor.applicationId,
      executor.environment,
      backend.environment,
      backend.identity.applicationId,
      backend.identity.mode,
    ],
  );
}
/** No local mutation until the original executor live-lease apply and completion CAS. */
export async function processUnboundShippingInput(
  database: SellerDatabase,
  context: ShippingJobRow & {
    kind: "shipping.input-expiry";
    executionToken: string;
  },
): Promise<EffectResult> {
  await inTransaction(database, (tx) =>
    authorizeShippingArtifact(tx, context, context.executionToken),
  );
  return {
    resultId: context.resourceId,
    lock: (tx) =>
      authorizeShippingArtifact(tx, context, context.executionToken),
    apply: (tx) => expireUnboundShippingInput(tx, context),
  };
}
