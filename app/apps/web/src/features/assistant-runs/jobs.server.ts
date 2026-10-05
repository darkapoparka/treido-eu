import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { EffectResult } from "../../server/jobs/execution.server";
import { JobError } from "../../server/jobs/model";
import { SellerError } from "../sellers/errors";
import {
  authorizeAssistantMaintenance,
  type AssistantMaintenanceContext,
} from "./maintenance-authority.server";
import { expireAssistantMedia, expireAssistantRun } from "./retention.server";
import { reconcileAssistantUsage } from "./execution.server";
export async function processAssistantMaintenanceJob(
  database: SellerDatabase,
  job: AssistantMaintenanceContext,
): Promise<EffectResult> {
  await inTransaction(database, async (tx) => {
    await authorizeAssistantMaintenance(tx, job, job.kind);
  });
  if (job.kind === "assistant.media-expiry") {
    if ((await expireAssistantMedia(database, job)).pending)
      throw new JobError("NOT_AVAILABLE");
  } else if (job.kind === "assistant.run-expiry")
    await expireAssistantRun(database, job);
  else if (
    (await reconcileAssistantUsage(database, job.resourceId, job)).pending
  )
    throw new JobError("NOT_AVAILABLE");
  return {
    resultId: job.resourceId,
    lock: async (tx) => {
      await authorizeAssistantMaintenance(tx, job, job.kind);
    },
  };
}
/** Sole canonical owner supplies the bounded original enqueue/repair function.
 * Missing registration is unavailable; an absent seam cannot look successful. */
export async function scheduleAssistantMaintenance(
  database: SellerDatabase,
): Promise<number> {
  return inTransaction(database, async (tx) => {
    const ready = (
      await tx.client.query<{ ready: boolean }>(
        "SELECT to_regprocedure('treido.assistant_enqueue_maintenance(integer)') IS NOT NULL AS ready",
      )
    ).rows[0]?.ready;
    if (!ready) throw new SellerError("NOT_AVAILABLE");
    const count = (
      await tx.client.query<{ count: number }>(
        "SELECT treido.assistant_enqueue_maintenance(20) AS count",
      )
    ).rows[0]?.count;
    if (
      !Number.isSafeInteger(count) ||
      count === undefined ||
      count < 0 ||
      count > 20
    )
      throw new SellerError("NOT_AVAILABLE");
    return count;
  });
}
