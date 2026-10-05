import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { shippingStorageAvailable } from "./registry.server";
import { requireJobBindings } from "../../server/jobs/config.server";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
export type ShippingExpiryContext = {
  id: string;
  kind: "shipping.input-expiry";
  authority: "shipping";
  buyerId: string;
  sellerId: null;
  actorId: null;
  resourceId: string;
  operationKey: string;
  generation: number;
  executionToken: string;
};
/** Only the existing canonical executor can pass this original signed lease.
 * No sweep, scheduler, generic service identity or deletion by a browser ID. */
export async function expireUnboundShippingInput(
  tx: SellerTransaction,
  job: ShippingExpiryContext,
) {
  if (
    job.kind !== "shipping.input-expiry" ||
    job.authority !== "shipping" ||
    job.sellerId !== null ||
    job.actorId !== null ||
    job.operationKey !== job.resourceId ||
    !Number.isSafeInteger(job.generation) ||
    job.generation < 1 ||
    [job.id, job.buyerId, job.resourceId, job.executionToken].some(
      (id) => !validId(id),
    )
  )
    throw new SellerError("FORBIDDEN");
  if (!(await shippingStorageAvailable(tx)))
    throw new SellerError("NOT_AVAILABLE");
  const binding = requireJobBindings(),
    backend = requireBackendBindings();
  const actual = (
    await tx.client.query(
      "SELECT o.id FROM treido.outbox_jobs o JOIN treido.job_effects e ON e.job_id=o.id JOIN treido.order_shipping_choices c ON c.id=o.resource_id AND c.buyer_id=o.buyer_id JOIN treido.order_shipping_policies p ON p.id=(c.snapshot->'option'->'policy'->>'id')::uuid WHERE o.id=$1 AND o.kind='shipping.input-expiry' AND o.authority='shipping' AND o.seller_id IS NULL AND o.buyer_id=$2 AND o.actor_id IS NULL AND o.resource_id=$3 AND o.operation_key=$3::uuid AND o.generation=$4 AND o.state IN('pending','accepted') AND o.intent_hash=treido.order_shipping_input_intent_hash($2,$3) AND e.kind=o.kind AND e.operation_key=o.operation_key AND e.state='running' AND e.execution_token=$5 AND e.execution_until>clock_timestamp() AND p.environment=$6",
      [
        job.id,
        job.buyerId,
        job.resourceId,
        job.generation,
        job.executionToken,
        backend.environment,
      ],
    )
  ).rows[0];
  if (!actual) throw new SellerError("FORBIDDEN");
  await tx.client.query(
    "SELECT treido.order_shipping_expire_input($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [
      job.id,
      job.buyerId,
      job.resourceId,
      job.generation,
      job.executionToken,
      binding.applicationId,
      binding.environment,
      backend.environment,
      backend.identity.applicationId,
      backend.identity.mode,
    ],
  );
}
/** T64 incorporates this into the EXISTING closure/obligation aggregation.
 * Missing schema/current integration is unavailable, never zero obligations. */
export async function readShippingLifecycleFacts(
  tx: SellerTransaction,
  userId: string,
) {
  if (!validId(userId)) throw new SellerError("INVALID_INPUT");
  if (!(await shippingStorageAvailable(tx)))
    throw new SellerError("NOT_AVAILABLE");
  const ready = (
    await tx.client.query<{ present: boolean }>(
      "SELECT to_regprocedure('treido.order_shipping_retention_ready(uuid,text,text)') IS NOT NULL AND to_regprocedure('treido.order_shipping_recipient_obligations_clear(uuid)') IS NOT NULL AS present",
    )
  ).rows[0];
  if (!ready?.present) throw new SellerError("NOT_AVAILABLE");
  const policies = (
    await tx.client.query<{ ready: boolean }>(
      "SELECT treido.order_shipping_retention_ready(p.id,p.environment,p.application_id) AS ready FROM treido.order_shipping_policies p WHERE EXISTS(SELECT 1 FROM treido.order_shipping_choices c WHERE c.buyer_id=$1 AND c.snapshot->'option'->'policy'->>'id'=p.id::text)",
      [userId],
    )
  ).rows;
  if (policies.some((policy) => policy.ready !== true))
    throw new SellerError("NOT_AVAILABLE");
  return (
    await tx.client.query<{
      unboundPrivateInputs: number;
      unconfirmedShipping: number;
      unresolvedRefunds: number;
      retainedAcceptedRecipients: number;
    }>(
      "SELECT (SELECT count(*)::int FROM treido.order_shipping_recipients r JOIN treido.order_shipping_choices c ON c.id=r.choice_id WHERE r.buyer_id=$1 AND r.value IS NOT NULL AND c.quote_id IS NULL) AS \"unboundPrivateInputs\",(SELECT count(*)::int FROM treido.order_shipping_choices c JOIN treido.paid_orders o ON o.quote_id=c.quote_id WHERE c.buyer_id=$1 AND NOT treido.order_shipping_recipient_obligations_clear(c.id)) AS \"unconfirmedShipping\",(SELECT count(*)::int FROM treido.order_refund_intents i JOIN treido.order_shipping_choices c ON c.quote_id=i.quote_id WHERE c.buyer_id=$1 AND i.state<>'expired' AND (i.state<>'succeeded' OR i.provider_status IS DISTINCT FROM 'succeeded' OR i.settlement_state<>'verified')) AS \"unresolvedRefunds\",(SELECT count(*)::int FROM treido.order_shipping_recipients r JOIN treido.order_shipping_choices c ON c.id=r.choice_id WHERE r.buyer_id=$1 AND c.quote_id IS NOT NULL AND r.value IS NOT NULL) AS \"retainedAcceptedRecipients\"",
      [userId],
    )
  ).rows[0];
}
