import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import {
  InsightError,
  insightRange,
  type InsightQuery,
  type InsightRow,
} from "./model";

function literalMatch(column: string, parameter: string) {
  const fold = (value: string) =>
    `lower(translate(${value},'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ'))`;
  return `strpos(${fold(column)},${fold(parameter)})>0`;
}

/** Fixed SQL built only by feature source. No browser expression, order or table name. */
export type InsightSource = { sql: string; params: unknown[] };
export type StoredInsightRow = Omit<InsightRow, "at"> & { at: Date | string };
export async function readInsightSource(
  tx: SellerTransaction,
  source: InsightSource,
  query: InsightQuery,
  limit: number,
): Promise<InsightRow[]> {
  const { from, until } = insightRange(query);
  const n = source.params.length;
  const p = (offset: number) => "$" + (n + offset);
  // All branches project the same narrow contract. Source ownership predicates
  // precede this shared filtering layer; no private evidence reaches it.
  const rows = (
    await tx.client.query<StoredInsightRow>(
      `WITH bounds AS (SELECT ${p(1)}::timestamptz AS start_at,${p(2)}::timestamptz AS end_at), source AS (${source.sql})
     SELECT id,"resourceId",label,status,kind,at,href,reason,"values" FROM source
     WHERE (${p(3)}='all' OR status=${p(3)}) AND (${p(4)}='all' OR kind=${p(4)})
       AND (${p(5)}='' OR ${literalMatch("label", p(5))} OR strpos("resourceId",${p(5)})>0)
       AND (${p(6)}='all' OR reason=${p(6)})
       AND (${p(7)}='all' OR (status='open' AND ${ageBandSql("at")}=${p(7)}))
     ORDER BY at DESC,id DESC LIMIT ${p(8)}`,
      [
        ...source.params,
        from,
        until,
        query.status,
        query.kind,
        query.q,
        query.reason,
        query.age,
        limit + 1,
      ],
    )
  ).rows;
  if (rows.length > limit)
    throw new InsightError(
      limit < 2000 ? "EXPORT_TOO_LARGE" : "SCOPE_TOO_LARGE",
    );
  return rows.map((row) => ({
    ...row,
    at:
      row.at instanceof Date
        ? row.at.toISOString()
        : new Date(row.at).toISOString(),
  }));
}
// Time predicates use half-open UTC days and immutable event/cohort timestamps.
export const inRange = (column: string) =>
  `${column}>=(SELECT start_at FROM bounds) AND ${column}<(SELECT end_at FROM bounds)`;
export const emptyValues = "'{}'::jsonb AS \"values\"";

/** Fixed age buckets; this is backlog observation, never response time or SLA. */
export function ageBandSql(column: string) {
  return `CASE WHEN ${column}>transaction_timestamp()-interval '1 day' THEN 'lt1' WHEN ${column}>transaction_timestamp()-interval '7 days' THEN 'd1_7' WHEN ${column}>transaction_timestamp()-interval '30 days' THEN 'd7_30' WHEN ${column}>transaction_timestamp()-interval '90 days' THEN 'd30_90' ELSE 'gte90' END`;
}
