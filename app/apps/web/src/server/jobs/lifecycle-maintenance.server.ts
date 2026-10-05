import "server-only";
import { inTransaction, type SellerDatabase } from "../db/database";
import { scheduleAssistantMaintenance } from "../../features/assistant-runs/jobs.server";
import { scheduleClosureRepair } from "../../features/account-closure/jobs.server";

/** Optional new storage may be unavailable; unrelated existing repair still runs.
 * Query/grant/source failures propagate instead of becoming a successful zero. */
export async function scheduleLifecycleMaintenance(
  database: SellerDatabase,
  kind: "assistant" | "closure" | "shipping",
) {
  const signature =
    kind === "shipping"
      ? "treido.order_shipping_enqueue_maintenance(integer)"
      : kind === "assistant"
        ? "treido.assistant_enqueue_maintenance(integer)"
        : "treido.account_repair_closure(integer)";
  const ready = await inTransaction(
    database,
    async (tx) =>
      (
        await tx.client.query<{ ready: boolean }>(
          "SELECT to_regprocedure($1) IS NOT NULL AS ready",
          [signature],
        )
      ).rows[0]?.ready,
  );
  if (!ready) return { status: "unavailable" as const };
  const queued =
    kind === "shipping"
      ? await inTransaction(
          database,
          async (tx) =>
            (
              await tx.client.query<{ queued: number }>(
                "SELECT treido.order_shipping_enqueue_maintenance(20) AS queued",
              )
            ).rows[0].queued,
        )
      : kind === "assistant"
        ? await scheduleAssistantMaintenance(database)
        : await scheduleClosureRepair(database);
  return { status: "processed" as const, queued };
}
