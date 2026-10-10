export type ReportRange = { start: string; end: string };
export type ReportComparison =
  | "none"
  | "previous-period"
  | "previous-year"
  | "previous-year-weekday"
  | "custom";
const day = 86400000;
const date = (value: string) => new Date(`${value}T12:00:00Z`);
const iso = (value: Date) => value.toISOString().slice(0, 10);
const valid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(date(value).getTime()) &&
  iso(date(value)) === value;
export function reportComparisonRange(
  range: ReportRange,
  mode: ReportComparison,
): ReportRange | undefined {
  if (mode === "none") return { start: "", end: "" };
  if (
    !valid(range.start) ||
    !valid(range.end) ||
    range.start > range.end ||
    mode === "custom"
  )
    return undefined;
  const start = date(range.start);
  const end = date(range.end);
  if (mode === "previous-period") {
    const length = (end.getTime() - start.getTime()) / day + 1;
    return {
      start: iso(new Date(start.getTime() - length * day)),
      end: iso(new Date(start.getTime() - day)),
    };
  }
  if (mode === "previous-year-weekday")
    return {
      start: iso(new Date(start.getTime() - 364 * day)),
      end: iso(new Date(end.getTime() - 364 * day)),
    };
  if (mode !== "previous-year") return undefined;
  const previous = (value: Date) => {
    const shifted = new Date(
      Date.UTC(
        value.getUTCFullYear() - 1,
        value.getUTCMonth(),
        value.getUTCDate(),
        12,
      ),
    );
    if (shifted.getUTCMonth() !== value.getUTCMonth()) shifted.setUTCDate(0);
    return iso(shifted);
  };
  return { start: previous(start), end: previous(end) };
}
export function reportRangeLabel(
  range: ReportRange,
  language: "en" | "bg",
  today = new Date().toISOString().slice(0, 10),
) {
  if (!range.start && !range.end)
    return language === "bg" ? "Цялото време" : "All time";
  if (valid(range.start) && valid(range.end)) {
    const inclusiveDays =
      (date(range.end).getTime() - date(range.start).getTime()) / day + 1;
    if (range.end === today && inclusiveDays === 30)
      return language === "bg" ? "Последни 30 дни" : "Last 30 days";
    const format = new Intl.DateTimeFormat(
      language === "bg" ? "bg-BG" : "en-US",
      { month: "short", day: "numeric", timeZone: "UTC" },
    );
    return `${format.format(date(range.start))} – ${format.format(date(range.end))}, ${date(range.end).getUTCFullYear()}`;
  }
  return `${range.start || "…"} – ${range.end || "…"}`;
}
export const comparisonLabels = [
  ["none", "No comparison", "Без сравнение"],
  ["previous-period", "Previous period", "Предишен период"],
  ["previous-year", "Previous year", "Предишна година"],
  [
    "previous-year-weekday",
    "Previous year (match day of week)",
    "Предишна година (същият ден от седмицата)",
  ],
  ["custom", "Custom comparison", "Персонализирано сравнение"],
] as const;
