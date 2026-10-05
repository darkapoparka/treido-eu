import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { SellerError } from "../sellers/errors";
import { uuid } from "./model";
import { requireInputStorage } from "./storage.server";
export type AssistantMaintenanceKind =
  "assistant.media-expiry" | "assistant.run-expiry" | "assistant.usage";
export type AssistantMaintenanceContext = {
  id: string;
  kind: AssistantMaintenanceKind;
  authority: "assistant";
  sellerId: null;
  buyerId: string;
  actorId: null;
  resourceId: string;
  operationKey: string;
  generation: number;
  executionToken: string;
};
/** Original accepted artifact/lease authority survives account restriction only
 * for expiry or exact usage GET. This never authorizes interpretation or reads. */
export async function authorizeAssistantMaintenance(
  tx: SellerTransaction,
  job: AssistantMaintenanceContext,
  expected: AssistantMaintenanceKind,
) {
  if (
    job.kind !== expected ||
    ![
      "assistant.media-expiry",
      "assistant.run-expiry",
      "assistant.usage",
    ].includes(expected) ||
    job.authority !== "assistant" ||
    job.sellerId !== null ||
    job.actorId !== null ||
    job.operationKey !== job.resourceId ||
    !Number.isSafeInteger(job.generation) ||
    job.generation < 1
  )
    throw new SellerError("FORBIDDEN");
  for (const id of [
    job.id,
    job.buyerId,
    job.resourceId,
    job.operationKey,
    job.executionToken,
  ])
    uuid(id);
  await requireInputStorage(tx);
  const binding = requireBackendBindings();
  const actual = (
    await tx.client.query(
      `SELECT j.id FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.id=$1 AND j.kind=$2 AND j.authority='assistant' AND j.seller_id IS NULL AND j.buyer_id=$3 AND j.actor_id IS NULL AND j.resource_id=$4 AND j.operation_key=$4 AND j.generation=$5 AND e.state='running' AND e.execution_token=$6 AND e.execution_until>clock_timestamp()`,
      [
        job.id,
        expected,
        job.buyerId,
        job.resourceId,
        job.generation,
        job.executionToken,
      ],
    )
  ).rows[0];
  if (!actual) throw new SellerError("FORBIDDEN");
  // Every ordinary command shares this human lock before any platform/resource
  // lock. No exception is added to authorizeHuman's active-status contract.
  const owner = await tx.client.query(
    "SELECT id FROM treido.users WHERE id=$1 FOR UPDATE",
    [job.buyerId],
  );
  if (owner.rowCount !== 1) throw new SellerError("NOT_FOUND");
  if (expected === "assistant.media-expiry") {
    const media = (
      await tx.client.query(
        "SELECT a.id FROM treido.assistant_media_assets a JOIN treido.assistant_runtime_policies p ON p.id=a.policy_id WHERE a.id=$1 AND a.user_id=$2 AND (a.expires_at<=clock_timestamp() OR a.state='cancelled') AND p.application_id=$3 AND p.environment=$4 AND p.approved_at<=clock_timestamp() FOR UPDATE OF a",
        [
          job.resourceId,
          job.buyerId,
          binding.identity.applicationId,
          binding.environment,
        ],
      )
    ).rows[0];
    if (!media) throw new SellerError("FORBIDDEN");
  } else {
    const run = (
      await tx.client.query(
        `SELECT r.id FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.id=$1 AND r.user_id=$2 AND b.application_id=$3 AND b.environment=$4 AND ${expected === "assistant.run-expiry" ? "r.expires_at<=clock_timestamp()" : "r.emission_started_at IS NOT NULL AND r.provider_id IS NOT NULL AND r.mode<>'voice'"} FOR UPDATE OF r`,
        [
          job.resourceId,
          job.buyerId,
          binding.identity.applicationId,
          binding.environment,
        ],
      )
    ).rows[0];
    if (!run) throw new SellerError("FORBIDDEN");
  }
}
