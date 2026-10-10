/** Spreadsheet-safe RFC 4180 cells. Exports contain authorized server rows only. */
export function merchantCsv(rows: readonly (readonly (string | number | null)[])[]) {
  const cell = (raw: string | number | null) => {
    let value = raw === null ? "" : String(raw);
    if (typeof raw === "string" && /^[\s]*[=+\-@]/u.test(value)) value = "'" + value;
    return '"' + value.replaceAll('"', '""') + '"';
  };
  return "\ufeff" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
