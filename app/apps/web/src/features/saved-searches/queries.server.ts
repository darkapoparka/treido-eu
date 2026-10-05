import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { criteriaIntent, SEARCH_LIMITS, type SearchView } from "./model";
import {
  requireSearchStorage,
  searchActorKey,
  searchColumns,
  searchFrom,
  type SearchRow,
} from "./storage.server";
export async function readSavedSearches(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<SearchView> {
  return inTransaction(database, async (tx) => {
    await requireSearchStorage(tx);
    const empty: SearchView = {
      actorKey: searchActorKey(identity),
      revision: 0,
      searches: [],
      checkedAt: new Date().toISOString(),
    };
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return empty;
      throw error;
    }
    const revision =
      (
        await tx.client.query<{ revision: number }>(
          "SELECT revision FROM treido.buyer_saved_search_workspaces WHERE user_id=$1",
          [user.id],
        )
      ).rows[0]?.revision ?? 0;
    const rows = (
      await tx.client.query<
        SearchRow & {
          run: {
            state: "running" | "bounded" | "finished" | "cancelled" | "failed";
            checked: number;
            observed: number;
          } | null;
        }
      >(
        `SELECT ${searchColumns},
      (SELECT jsonb_build_object('state',CASE WHEN r.state='running' AND EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='buyer.saved-search' AND j.resource_id=r.id AND j.state='dead') THEN 'failed' ELSE r.state END,'checked',r.checked,'observed',r.observed)
       FROM treido.buyer_saved_search_runs r WHERE r.user_id=s.user_id AND r.search_id=s.id AND r.criteria_version=s.criteria_version AND r.consent_generation=s.consent_generation ORDER BY r.created_at DESC,r.id DESC LIMIT 1) AS run
      ${searchFrom} WHERE s.user_id=$1 AND s.status<>'removed' ORDER BY s.created_at DESC,s.id DESC LIMIT $2`,
        [user.id, SEARCH_LIMITS.searches],
      )
    ).rows;
    return {
      ...empty,
      revision,
      searches: rows.map((row) => {
        const intent = criteriaIntent(row.criteria);
        return {
          id: row.id,
          name: row.name ?? "",
          status: row.status as "paused" | "enabled",
          version: row.version,
          generation: row.generation,
          frequency: row.frequency,
          criteria: row.criteria,
          intent,
          needsReview: !intent,
          consentAt: row.consentAt?.toISOString() ?? null,
          lastCheckAt: row.lastCheckAt?.toISOString() ?? null,
          run: row.run,
        };
      }),
    };
  });
}
