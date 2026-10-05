import "server-only";
import { randomUUID } from "node:crypto";
import type { SellerTransaction } from "../../server/db/database";
import { buildToolQuery } from "../shopping-tools/catalogue-sql.server";
import { readToolFacts } from "../shopping-tools/catalogue.server";
import {
  publishedJoins,
  publishedEligibility,
} from "../catalog/publication-eligibility.server";
import {
  observe,
  type Observation,
  type ToolListing,
} from "../shopping-tools/model";
import type { ToolIntent } from "../shopping-tools/intent";
import type { SearchRun } from "./runs.server";
import { SEARCH_LIMITS, type MatchKind } from "./model";
type OldObservation = Observation & { eligible: boolean; changeNumber: number };
const observedColumns = `listing_id AS "listingId",publication_revision AS "publicationRevision",sku_id AS "skuId",price_minor AS "priceMinor",stock_state AS stock,eligible,change_number AS "changeNumber"`;
function fact(old: OldObservation): Observation {
  return {
    listingId: old.listingId,
    publicationRevision: old.publicationRevision,
    skuId: old.skuId,
    priceMinor: old.priceMinor,
    stock: old.stock,
  };
}
function same(a: Observation, b: Observation) {
  return (
    a.publicationRevision === b.publicationRevision &&
    a.skuId === b.skuId &&
    a.priceMinor === b.priceMinor &&
    a.stock === b.stock
  );
}
/** Minimal observation/delivery data only. Public titles/images are always
 * projected afresh by the existing catalogue eligibility boundary at read time. */
export async function observeSearchCandidates(
  tx: SellerTransaction,
  run: SearchRun,
  intent: ToolIntent,
  ids: string[],
) {
  let added = 0;
  for (
    let start = 0;
    start < ids.length;
    start += SEARCH_LIMITS.observedBatch
  ) {
    const batch = ids.slice(start, start + SEARCH_LIMITS.observedBatch);
    const blocked = new Set(
      (
        await tx.client.query<{ id: string }>(
          `SELECT l.id FROM treido.listings l JOIN treido.contact_preferences cp ON cp.seller_id=l.seller_id AND cp.buyer_id=$1 WHERE l.id=ANY($2::uuid[]) AND (cp.buyer_blocked OR cp.seller_blocked)`,
          [run.userId, batch],
        )
      ).rows.map((row) => row.id),
    );
    const current = await readToolFacts(tx, batch);
    const matching = new Set(
      (
        await tx.client.query<{ id: string }>(
          buildToolQuery({ ...intent, cursor: null }, null, { ids: batch }),
        )
      ).rows.map((row) => row.id),
    );
    for (const listingId of batch) {
      if (blocked.has(listingId)) continue;
      const old = (
        await tx.client.query<OldObservation>(
          `SELECT ${observedColumns} FROM treido.buyer_search_observations WHERE user_id=$1 AND search_id=$2 AND criteria_version=$3 AND listing_id=$4`,
          [run.userId, run.searchId, run.version, listingId],
        )
      ).rows[0];
      const item = current.get(listingId),
        eligible = !!item && matching.has(listingId),
        now = item ? observe(item) : null;
      if (!old && (!eligible || !now)) continue;
      if (old && old.eligible === eligible && (!now || same(fact(old), now)))
        continue;
      if (!old) {
        const count = (
          await tx.client.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM treido.buyer_search_observations WHERE user_id=$1 AND search_id=$2 AND criteria_version=$3",
            [run.userId, run.searchId, run.version],
          )
        ).rows[0].count;
        if (count >= SEARCH_LIMITS.observations) continue;
        added++;
      }
      const next = now ?? (old ? fact(old) : null);
      if (!next) continue;
      const number = (old?.changeNumber ?? 0) + 1;
      await tx.client.query(
        `INSERT INTO treido.buyer_search_observations(user_id,search_id,criteria_version,listing_id,publication_revision,sku_id,price_minor,stock_state,eligible,change_number)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(user_id,search_id,criteria_version,listing_id) DO UPDATE SET
        publication_revision=excluded.publication_revision,sku_id=excluded.sku_id,price_minor=excluded.price_minor,stock_state=excluded.stock_state,eligible=excluded.eligible,change_number=excluded.change_number,observed_at=clock_timestamp()`,
        [
          run.userId,
          run.searchId,
          run.version,
          listingId,
          next.publicationRevision,
          next.skuId,
          next.priceMinor,
          next.stock,
          eligible,
          number,
        ],
      );
      const kinds: MatchKind[] = [];
      if (!old && eligible) kinds.push("new_publication");
      else if (old) {
        if (old.eligible && !eligible) kinds.push("unavailable");
        // Representative SKU changes are not a comparable-item price drop.
        if (
          item &&
          old.skuId === now?.skuId &&
          old.priceMinor !== now?.priceMinor &&
          eligible
        )
          kinds.push("price_changed");
        if (item && old.stock !== now?.stock) kinds.push("stock_changed");
      }
      for (const kind of kinds) {
        await tx.client.query(
          `INSERT INTO treido.buyer_search_notifications(id,user_id,search_id,criteria_version,consent_generation,listing_id,change_number,kind,previous_fact,observed_fact)
          SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb FROM treido.buyer_saved_searches s JOIN treido.users u ON u.id=s.user_id
          WHERE s.id=$3 AND s.user_id=$2 AND u.status='active' AND s.status='enabled' AND s.consent_at IS NOT NULL AND s.criteria_version=$4 AND s.consent_generation=$5
          AND NOT EXISTS(SELECT 1 FROM treido.listings source JOIN treido.contact_preferences cp ON cp.seller_id=source.seller_id AND cp.buyer_id=$2 WHERE source.id=$6 AND (cp.buyer_blocked OR cp.seller_blocked))
          AND ($8='unavailable' OR EXISTS(SELECT 1 ${publishedJoins} WHERE l.id=$6 AND ${publishedEligibility}))
          ON CONFLICT(user_id,search_id,criteria_version,listing_id,change_number,kind) DO NOTHING`,
          [
            randomUUID(),
            run.userId,
            run.searchId,
            run.version,
            run.generation,
            listingId,
            number,
            kind,
            old ? JSON.stringify(fact(old)) : null,
            now ? JSON.stringify(now) : null,
          ],
        );
      }
    }
  }
  return added;
}
export type CurrentSearchFact = ToolListing;
