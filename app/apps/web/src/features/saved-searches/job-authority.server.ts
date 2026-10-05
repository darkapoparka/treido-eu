import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { BuyerJobRow } from "../../server/jobs/outbox.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { criteriaIntent } from "./model";
import {
  requireSearchStorage,
  searchColumns,
  searchFrom,
  type SearchRow,
} from "./storage.server";
import { runStepKey, runColumns, type SearchRun } from "./runs.server";
/** Lock order: current human, subscription, then executor job/effect. No session
 * token, selected seller or service bypass supplies buyer notification consent. */
export async function authorizeSearchJob(
  tx: SellerTransaction,
  job: BuyerJobRow,
  exclusive = false,
) {
  await requireSearchStorage(tx);
  const human = (
    await tx.client.query<{ subject: string }>(
      "SELECT clerk_subject AS subject FROM treido.users WHERE id=$1",
      [job.buyerId],
    )
  ).rows[0];
  if (!human || job.actorId !== job.buyerId) throw new SellerError("FORBIDDEN");
  const user = await authorizeHuman(tx, { subject: human.subject }, false);
  if (user.id !== job.buyerId) throw new SellerError("FORBIDDEN");
  const run = (
    await tx.client.query<SearchRun>(
      `SELECT ${runColumns} FROM treido.buyer_saved_search_runs r WHERE r.user_id=$1 AND r.id=$2`,
      [user.id, job.resourceId],
    )
  ).rows[0];
  if (!run) throw new SellerError("FORBIDDEN");
  const search = (
    await tx.client.query<SearchRow>(
      `SELECT ${searchColumns} ${searchFrom} WHERE s.user_id=$1 AND s.id=$2 FOR ${exclusive ? "UPDATE" : "SHARE"} OF s`,
      [user.id, run.searchId],
    )
  ).rows[0];
  if (
    !search ||
    search.status !== "enabled" ||
    !search.consentAt ||
    search.version !== run.version ||
    search.generation !== run.generation ||
    !criteriaIntent(search.criteria)
  )
    throw new SellerError("FORBIDDEN");
  // A successfully completed step can replay its executor acknowledgment, while
  // obsolete/cancelled criteria generations remain ineligible even on replay.
  if (
    run.state === "cancelled" ||
    (job.state !== "completed" &&
      (run.state !== "running" ||
        job.operationKey !== runStepKey(run.id, run.step)))
  )
    throw new SellerError("FORBIDDEN");
  return { search, run };
}
