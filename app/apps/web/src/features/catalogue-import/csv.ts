export const CSV_LIMITS = {
  bytes: 10 * 1024 * 1024,
  rows: 1000,
  chunkBytes: 128 * 1024,
  cell: 24000,
  columns: 14,
  page: 25,
  batch: 5,
} as const;
export const CSV_COLUMNS = [
  "external_id",
  "title",
  "description",
  "category_id",
  "condition",
  "price",
  "currency",
  "locality",
  "inventory_mode",
  "quantity",
  "sku",
  "attributes_json",
  "options_json",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];
export type CsvRow = Partial<Record<CsvColumn, string>>;
export class CsvError extends Error {
  constructor(
    readonly code:
      | "empty_file"
      | "too_many_rows"
      | "invalid_csv"
      | "invalid_columns"
      | "cell_too_long"
      | "invalid_encoding"
      | "file_too_large",
  ) {
    super(code);
  }
}
/** RFC-style quoted CSV with CRLF/LF, embedded newlines and escaped quotes. Never evaluates cells. */
export function parseCsv(source: string): CsvRow[] {
  if (typeof source !== "string" || !source.length)
    throw new CsvError("empty_file");
  if (source.length > CSV_LIMITS.bytes) throw new CsvError("file_too_large");
  if (source.includes("\u0000")) throw new CsvError("invalid_encoding");
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const records: string[][] = [];
  let record: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const finishCell = () => {
    record.push(cell);
    cell = "";
    closed = false;
    if (record.length > CSV_LIMITS.columns)
      throw new CsvError("invalid_columns");
  };
  const finishRow = () => {
    finishCell();
    if (record.some((value) => value !== "")) records.push(record);
    record = [];
    if (records.length > CSV_LIMITS.rows + 1)
      throw new CsvError("too_many_rows");
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === ",") finishCell();
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      finishRow();
    } else if (char === '"') {
      if (cell || closed) throw new CsvError("invalid_csv");
      quoted = true;
    } else {
      if (closed) throw new CsvError("invalid_csv");
      cell += char;
    }
    if (cell.length > CSV_LIMITS.cell) throw new CsvError("cell_too_long");
  }
  if (quoted) throw new CsvError("invalid_csv");
  if (cell || record.length || closed) finishRow();
  if (records.length < 2) throw new CsvError("empty_file");
  const header = records.shift()!.map((value) => value.trim().toLowerCase());
  if (
    new Set(header).size !== header.length ||
    header.some((key) => !(CSV_COLUMNS as readonly string[]).includes(key)) ||
    [
      "external_id",
      "title",
      "category_id",
      "condition",
      "price",
      "currency",
    ].some((key) => !header.includes(key))
  )
    throw new CsvError("invalid_columns");
  return records.map((values) => {
    if (values.length !== header.length) throw new CsvError("invalid_csv");
    if (JSON.stringify(values).length > 46000)
      throw new CsvError("cell_too_long");
    return Object.fromEntries(
      header.map((key, index) => [key, values[index]]),
    ) as CsvRow;
  });
}
/** Quote all cells and neutralize spreadsheet formulas, including whitespace-prefixed formulas. */
export function csvCell(raw: unknown): string {
  let value = String(raw ?? "");
  if (/^[\s\uFEFF]*[=+@-]/u.test(value) || /^[\t\r\n]/.test(value))
    value = "'" + value;
  return '"' + value.replaceAll('"', '""') + '"';
}
export function csvDocument(
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
) {
  return (
    "\uFEFF" +
    [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
