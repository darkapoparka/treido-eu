import "server-only";
import { inRange, emptyValues, type InsightSource } from "./sql.server";
import type { OperatorDataset } from "./model";

/** Called only after a locked, current reports.read grant. Projections contain
 * no reporter, appellant, reviewer, message text, evidence or decision reason. */
export function operatorInsightSource(
  dataset: OperatorDataset,
  formalStorage: boolean,
): InsightSource {
  let sql: string;
  switch (dataset) {
    case "report_backlog":
    case "reports":
      sql = `SELECT r.id::text AS id,r.id::text AS "resourceId",r.resource_id::text AS label,
        CASE WHEN r.state='open' THEN 'open' ELSE 'resolved' END AS status,r.resource_kind AS kind,r.created_at AS at,
        '/ops/reports/'||r.id::text AS href,r.reason,${emptyValues}
        FROM treido.reports r ${dataset === "reports" ? "WHERE " + inRange("r.created_at") : ""}`;
      break;
    case "appeal_backlog":
    case "appeals":
      sql = `SELECT a.id::text AS id,a.id::text AS "resourceId",m.listing_id::text AS label,
        ${formalStorage ? "CASE WHEN d.id IS NULL THEN 'open' ELSE 'resolved' END" : "'unknown'::text"} AS status,
        m.next_state AS kind,a.created_at AS at,'/ops/appeals/'||a.id::text AS href,''::text AS reason,${emptyValues}
        FROM treido.moderation_appeals a JOIN treido.moderation_actions m ON m.id=a.action_id
        ${formalStorage ? "LEFT JOIN treido.trust_case_decisions d ON d.kind='appeal' AND d.case_id=a.id" : ""}
        ${dataset === "appeals" ? "WHERE " + inRange("a.created_at") : ""}`;
      break;
    case "case_outcomes":
      sql = `SELECT d.id::text AS id,d.case_id::text AS "resourceId",d.resource_id::text AS label,d.outcome AS status,d.kind,d.created_at AS at,
        CASE WHEN d.kind='appeal' THEN '/ops/appeals/' ELSE '/ops/reports/' END||d.case_id::text AS href,''::text AS reason,${emptyValues}
        FROM treido.trust_case_decisions d WHERE ${inRange("d.created_at")}`;
      break;
    case "listing_decisions":
      sql = `SELECT m.id::text AS id,m.listing_id::text AS "resourceId",m.listing_id::text AS label,m.next_state AS status,m.prior_state AS kind,
        m.created_at AS at,'/ops/listings/'||m.listing_id::text AS href,''::text AS reason,${emptyValues}
        FROM treido.moderation_actions m WHERE ${inRange("m.created_at")}`;
      break;
  }
  return { sql, params: [] };
}
