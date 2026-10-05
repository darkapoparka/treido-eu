import {
  CSV_LIMITS,
  CsvError,
  parseCsv,
  csvDocument,
} from "../catalogue-import/csv";
import {
  validateImportRow,
  type ParsedImportRow,
} from "../catalogue-import/model";
export type PreflightResult = {
  rows: ParsedImportRow[];
  valid: number;
  invalid: number;
};
/** Device-only preparation uses exactly the private importer's parser and row rules.
 * It never checks account quotas, creates drafts, uploads photos or approves publication. */
export function inspectSellerCsv(bytes: Uint8Array): PreflightResult {
  if (bytes.byteLength > CSV_LIMITS.bytes) throw new CsvError("file_too_large");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CsvError("invalid_encoding");
  }
  const rows = parseCsv(text).map((raw, index) =>
    validateImportRow(raw, index + 1),
  );
  const ids = new Map<string, number>();
  for (const row of rows)
    if (row.externalId)
      ids.set(row.externalId, (ids.get(row.externalId) ?? 0) + 1);
  for (const row of rows)
    if (row.externalId && (ids.get(row.externalId) ?? 0) > 1) {
      row.errors.push({ field: "external_id", code: "duplicate_external_id" });
      row.payload = null;
      row.inventory = null;
    }
  const valid = rows.filter((row) => row.errors.length === 0).length;
  return { rows, valid, invalid: rows.length - valid };
}
export function sellerCsvIssueReport(result: PreflightResult): string {
  return csvDocument(
    ["row", "external_id", "field", "code"],
    result.rows.flatMap((row) =>
      row.errors.map((issue) => [
        row.number,
        row.externalId ?? "",
        issue.field,
        issue.code,
      ]),
    ),
  );
}
