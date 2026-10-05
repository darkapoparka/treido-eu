import "server-only";
import {
  DATASETS,
  INSIGHT_LIMITS,
  InsightError,
  insightRange,
  type InsightReport,
} from "./model";
import {
  insightCopy,
  insightLabel,
  basisLabel,
  type InsightLanguage,
} from "./copy";
import { backlogAge } from "./summary";

function cell(value: string | number | null | undefined): string {
  const text = String(value ?? "").replace(
    /[\u0000-\u001f\u007f-\u009f]/g,
    " ",
  );
  return '"' + text.replaceAll('"', '""') + '"';
}
// Free-form titles and source filenames always begin with literal text, never
// a spreadsheet formula. Remaining columns are fixed labels, validated codes,
// owned UUIDs, server-built relative paths, UTC timestamps or nonnegative counts.
function literalText(value: string) {
  return value ? "text: " + value : "";
}
export function insightFilename(
  report: InsightReport,
  language: InsightLanguage,
) {
  return `treido-${report.scope.kind}-${report.query.dataset}-${report.query.from}-${report.query.to}-${language}.csv`;
}
export function insightsCsv(
  report: InsightReport,
  language: InsightLanguage,
): string {
  if (
    report.total > INSIGHT_LIMITS.exportRows ||
    report.rows.length !== report.total
  )
    throw new InsightError("EXPORT_TOO_LARGE");
  const { ui, definitions } = insightCopy(language),
    { query } = report,
    range = insightRange(query);
  const valueKeys = DATASETS[query.dataset].values;
  const header = [
    ui.rowType,
    ui.version,
    ui.datasetCode,
    ui.basis,
    ui.scopeId,
    ui.from,
    ui.until,
    ui.observed,
    ui.filters,
    ui.records,
    ui.definition,
    ui.recordId,
    ui.resourceId,
    ui.label,
    ui.state,
    ui.group,
    ui.reason,
    ui.recordTime,
    ui.age,
    ui.history,
    ...valueKeys.map((key) => insightLabel(language, key)),
  ];
  const filters = literalText(
    JSON.stringify({
      status: query.status,
      kind: query.kind,
      reason: query.reason,
      age: query.age,
      q: query.q,
    }),
  );
  const common = [
    "F17-v1",
    query.dataset,
    basisLabel(language, report.basis),
    report.scope.kind === "seller" ? report.scope.sellerId : "operator",
    report.basis === "snapshot" ? "" : range.from,
    report.basis === "snapshot" ? "" : range.until,
    report.observedAt,
    filters,
    report.total,
  ];
  const lines = [
    header.map(cell).join(","),
    [
      ui.measurement,
      ...common,
      definitions[query.dataset],
      ...Array<string>(9 + valueKeys.length).fill(""),
    ]
      .map(cell)
      .join(","),
  ];
  for (const row of report.rows) {
    const age =
      query.dataset.endsWith("_backlog") && row.status === "open"
        ? insightLabel(language, backlogAge(row.at, report.observedAt))
        : "";
    lines.push(
      [
        ui.record,
        ...common,
        "",
        row.id,
        row.resourceId,
        literalText(row.label),
        insightLabel(language, row.status),
        row.kind ? insightLabel(language, row.kind) : "",
        row.reason ? insightLabel(language, row.reason) : "",
        row.at,
        age,
        row.href + "?lang=" + language,
        ...valueKeys.map((key) => row.values[key] ?? null),
      ]
        .map(cell)
        .join(","),
    );
  }
  const result = "\uFEFF" + lines.join("\r\n") + "\r\n";
  if (Buffer.byteLength(result, "utf8") > INSIGHT_LIMITS.exportBytes)
    throw new InsightError("EXPORT_TOO_LARGE");
  return result;
}
