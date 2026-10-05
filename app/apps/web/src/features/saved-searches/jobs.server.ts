import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type {
  BuyerEffectContext,
  EffectResult,
} from "../../server/jobs/execution.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { buildToolQuery } from "../shopping-tools/catalogue-sql.server";
import type { ToolRow } from "../shopping-tools/catalogue.server";
import { criteriaIntent, SEARCH_LIMITS } from "./model";
import {
  searchStorageReady,
  searchColumns,
  searchFrom,
  type SearchRow,
} from "./storage.server";
import { authorizeSearchJob } from "./job-authority.server";
import { enqueueRunStep, startSearchRun, type SearchRun } from "./runs.server";
import { observeSearchCandidates } from "./matching.server";
export async function processSavedSearchJob(
  database: SellerDatabase,
  job: BuyerEffectContext,
): Promise<EffectResult> {
  return {
    resultId: job.resourceId,
    lock: async (tx) => {
      await authorizeSearchJob(tx, job, true);
    },
    apply: async (tx) => {
      const { search, run } = await authorizeSearchJob(tx, job, true),
        intent = criteriaIntent(search.criteria);
      if (!intent) throw new SellerError("FORBIDDEN");
      // Recency/ID is stable across available-variant price/stock edits. Public
      // display ranking remains the saved user choice; it is not a hard filter.
      const scan = {
        ...intent,
        cursor: null,
        discovery: { ...intent.discovery, sort: "newest" as const },
      };
      const next: SearchRun = { ...run, step: run.step + 1 };
      let ids: string[];
      if (run.phase === "catalogue") {
        const rows = (
          await tx.client.query<ToolRow>(
            buildToolQuery(scan, run.position, { ceiling: run.ceiling }),
          )
        ).rows;
        const selected = rows.slice(0, SEARCH_LIMITS.page),
          last = selected.at(-1);
        ids = selected.map((row) => row.id);
        next.cataloguePages++;
        next.checked += ids.length;
        if (last)
          next.position = {
            id: last.id,
            at: last.at,
            price: last.priceMinor,
            rank: last.rank,
          };
        if (
          rows.length <= SEARCH_LIMITS.page ||
          next.cataloguePages >= SEARCH_LIMITS.cataloguePages
        ) {
          next.phase = "observed";
          next.afterListingId = null;
        }
      } else {
        const rows = (
          await tx.client.query<{ id: string }>(
            `SELECT listing_id AS id FROM treido.buyer_search_observations WHERE user_id=$1 AND search_id=$2 AND criteria_version=$3 AND ($4::uuid IS NULL OR listing_id>$4::uuid) ORDER BY listing_id LIMIT $5`,
            [
              run.userId,
              run.searchId,
              run.version,
              run.afterListingId,
              SEARCH_LIMITS.observedBatch + 1,
            ],
          )
        ).rows;
        ids = rows.slice(0, SEARCH_LIMITS.observedBatch).map((row) => row.id);
        next.checked += ids.length;
        next.afterListingId = ids.at(-1) ?? run.afterListingId;
        if (rows.length <= SEARCH_LIMITS.observedBatch)
          next.state =
            run.cataloguePages >= SEARCH_LIMITS.cataloguePages
              ? "bounded"
              : "finished";
      }
      next.observed += await observeSearchCandidates(tx, run, intent, ids);
      await tx.client.query(
        `UPDATE treido.buyer_saved_search_runs SET phase=$2,position=$3::jsonb,after_listing_id=$4,step=$5,catalogue_pages=$6,checked=$7,observed=$8,state=$9 WHERE id=$1 AND user_id=$10`,
        [
          run.id,
          next.phase,
          next.position === null ? null : JSON.stringify(next.position),
          next.afterListingId,
          next.step,
          next.cataloguePages,
          next.checked,
          next.observed,
          next.state,
          run.userId,
        ],
      );
      if (next.state === "running") await enqueueRunStep(tx, next);
      else {
        await tx.client.query(
          "UPDATE treido.buyer_saved_searches SET last_check_at=clock_timestamp() WHERE id=$1 AND user_id=$2 AND criteria_version=$3 AND consent_generation=$4",
          [search.id, run.userId, run.version, run.generation],
        );
        // Work history is bounded to the current/latest run. Immutable command
        // acknowledgments and deduplication observations are separate records.
        await tx.client.query(
          "DELETE FROM treido.buyer_saved_search_runs WHERE user_id=$1 AND search_id=$2 AND id<>$3 AND state<>'running'",
          [run.userId, search.id, run.id],
        );
      }
    },
  };
}
/** Existing signed repair sweep schedules finite buyer work. Uninstalled F23
 * returns an explicit status and cannot block unrelated repair consumers. */
export async function scheduleSavedSearches(database: SellerDatabase) {
  const ready = await searchStorageReady({ client: database.pool });
  if (!ready) return { status: "unavailable" as const, scheduled: 0 };
  const due = (
    await database.pool.query<{ id: string; subject: string }>(
      `SELECT s.id,u.clerk_subject AS subject FROM treido.buyer_saved_searches s JOIN treido.users u ON u.id=s.user_id WHERE s.status='enabled' AND u.status='active' AND s.consent_at IS NOT NULL AND s.due_at<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM treido.buyer_saved_search_runs r WHERE r.search_id=s.id AND r.state='running') ORDER BY s.due_at,s.id LIMIT $1`,
      [SEARCH_LIMITS.schedulerBatch],
    )
  ).rows;
  let scheduled = 0,
    revoked = 0;
  for (const candidate of due) {
    try {
      const accepted = await inTransaction(database, async (tx) => {
        const user = await authorizeHuman(
          tx,
          { subject: candidate.subject },
          false,
        );
        const search = (
          await tx.client.query<SearchRow>(
            `SELECT ${searchColumns} ${searchFrom} WHERE s.id=$1 AND s.user_id=$2 AND s.status='enabled' AND s.due_at<=clock_timestamp() FOR UPDATE OF s SKIP LOCKED`,
            [candidate.id, user.id],
          )
        ).rows[0];
        if (!search || !search.consentAt || !criteriaIntent(search.criteria))
          return false;
        await startSearchRun(tx, search);
        return true;
      });
      if (accepted) scheduled++;
    } catch (error) {
      // A human revoked after the due read cannot stop unrelated repair work.
      // Real storage/executor failures still propagate for the original retry.
      if (
        !(error instanceof SellerError) ||
        !["NOT_FOUND", "FORBIDDEN"].includes(error.code)
      )
        throw error;
      revoked++;
    }
  }
  return { status: "scheduled" as const, scheduled, revoked };
}
