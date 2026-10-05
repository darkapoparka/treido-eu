import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { SellerTransaction } from "../../server/db/database";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { SellerError } from "../sellers/errors";
import type { SearchRow } from "./storage.server";
import type { ToolPosition } from "../shopping-tools/cursor.server";
export type SearchRun = {
  id: string;
  userId: string;
  searchId: string;
  version: number;
  generation: number;
  state: "running" | "finished" | "bounded" | "cancelled";
  phase: "catalogue" | "observed";
  position: ToolPosition | null;
  afterListingId: string | null;
  step: number;
  cataloguePages: number;
  checked: number;
  observed: number;
  ceiling: string;
};
export const runColumns = `r.id,r.user_id AS "userId",r.search_id AS "searchId",r.criteria_version AS version,r.consent_generation AS generation,r.state,r.phase,r.position,r.after_listing_id AS "afterListingId",r.step,r.catalogue_pages AS "cataloguePages",r.checked,r.observed,to_char(r.ceiling AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ceiling`;
export function runStepKey(runId: string, step: number) {
  const hex = createHash("sha256")
    .update("buyer-search-step-v1:" + runId + ":" + step)
    .digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    "a" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}
export async function enqueueRunStep(
  tx: SellerTransaction,
  run: Pick<SearchRun, "id" | "userId" | "step">,
) {
  return enqueueJob(tx, {
    kind: "buyer.saved-search",
    sellerId: null,
    buyerId: run.userId,
    resourceId: run.id,
    operationKey: runStepKey(run.id, run.step),
    actorId: run.userId,
    authority: "buyer",
  });
}
/** Called with current human and search locks, never from a render or a URL. */
export async function startSearchRun(
  tx: SellerTransaction,
  search: SearchRow,
  retryFailed = false,
) {
  const active = (
    await tx.client.query<{ id: string; live: boolean; failed: boolean }>(
      `SELECT r.id,
    EXISTS(SELECT 1 FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.resource_id=r.id AND j.kind='buyer.saved-search' AND e.state='running' AND e.execution_until>clock_timestamp()) AS live,
    EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.resource_id=r.id AND j.kind='buyer.saved-search' AND j.state='dead') AS failed
    FROM treido.buyer_saved_search_runs r WHERE r.user_id=$1 AND r.search_id=$2 AND r.state='running' FOR UPDATE`,
      [search.userId, search.id],
    )
  ).rows[0];
  if (active) {
    if (!retryFailed || !active.failed || active.live) return active.id;
    await tx.client.query(
      "UPDATE treido.buyer_saved_search_runs SET state='cancelled' WHERE id=$1",
      [active.id],
    );
  }
  if (search.status !== "enabled" || !search.consentAt)
    throw new SellerError("FORBIDDEN");
  const id = randomUUID();
  await tx.client.query(
    `INSERT INTO treido.buyer_saved_search_runs(id,user_id,search_id,criteria_version,consent_generation) VALUES($1,$2,$3,$4,$5)`,
    [id, search.userId, search.id, search.version, search.generation],
  );
  await enqueueRunStep(tx, { id, userId: search.userId, step: 0 });
  await tx.client.query(
    "UPDATE treido.buyer_saved_searches SET due_at=clock_timestamp()+make_interval(mins=>frequency_minutes) WHERE id=$1 AND user_id=$2",
    [search.id, search.userId],
  );
  return id;
}
