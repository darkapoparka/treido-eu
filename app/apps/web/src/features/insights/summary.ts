import {
  AGE_BANDS,
  DATASETS,
  InsightError,
  INSIGHT_LIMITS,
  type InsightReport,
  type InsightRow,
} from "./model";

export type InsightContext = Pick<
  InsightReport,
  | "scope"
  | "sellerName"
  | "actorKey"
  | "query"
  | "observedAt"
  | "basis"
  | "availableDatasets"
  | "formalStorage"
>;
export type InsightView = {
  context: InsightContext;
  report: InsightReport | null;
  problem: InsightError["code"] | null;
};
export function backlogAge(
  at: string,
  observedAt: string,
): (typeof AGE_BANDS)[number] {
  const age = Math.max(0, Date.parse(observedAt) - Date.parse(at)) / 86400000;
  return age < 1
    ? "lt1"
    : age < 7
      ? "d1_7"
      : age < 30
        ? "d7_30"
        : age < 90
          ? "d30_90"
          : "gte90";
}
function groups(
  rows: readonly InsightRow[],
  field: "status" | "kind" | "reason",
) {
  const counts = new Map<string, number>();
  for (const row of rows)
    if (row[field]) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
/** All counts describe the complete bounded matching set, never a sampled page.
 * Large scopes are refused upstream, so a returned zero means a successful read. */
export function summarizeInsights(
  context: InsightContext,
  rows: InsightRow[],
  exporting: boolean,
): InsightReport {
  const days = new Map<string, number>(),
    ages = new Map<string, number>(AGE_BANDS.map((key) => [key, 0]));
  for (const row of rows) {
    if (!Number.isFinite(Date.parse(row.at)))
      throw new InsightError("NOT_AVAILABLE");
    if (context.basis !== "snapshot")
      days.set(row.at.slice(0, 10), (days.get(row.at.slice(0, 10)) ?? 0) + 1);
    if (context.query.dataset.endsWith("_backlog") && row.status === "open") {
      const key = backlogAge(row.at, context.observedAt);
      ages.set(key, (ages.get(key) ?? 0) + 1);
    }
  }
  const values = DATASETS[context.query.dataset].values.map((key) => {
    let total = 0,
      known = 0;
    for (const row of rows) {
      const value = row.values[key];
      if (value === null || value === undefined) continue;
      if (
        !Number.isSafeInteger(value) ||
        value < 0 ||
        !Number.isSafeInteger(total + value)
      )
        throw new InsightError("NOT_AVAILABLE");
      total += value;
      known++;
    }
    return { key, total, known, unknown: rows.length - known };
  });
  return {
    ...context,
    total: rows.length,
    pages: Math.max(1, Math.ceil(rows.length / INSIGHT_LIMITS.page)),
    rows: exporting
      ? rows
      : rows.slice(
          (context.query.page - 1) * INSIGHT_LIMITS.page,
          context.query.page * INSIGHT_LIMITS.page,
        ),
    statuses: groups(rows, "status"),
    kinds: groups(rows, "kind"),
    reasons: groups(rows, "reason"),
    daily: [...days]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    ages: context.query.dataset.endsWith("_backlog")
      ? [...ages].map(([key, count]) => ({ key, count }))
      : [],
    values,
  };
}
