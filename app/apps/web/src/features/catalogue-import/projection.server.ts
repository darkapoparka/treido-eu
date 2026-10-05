import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { validateImportRow, type ParsedImportRow } from "./model";
import type { CsvRow } from "./csv";
export async function projectImportRows(
  tx: SellerTransaction,
  sellerId: string,
  rows: { number: number; raw: CsvRow }[],
): Promise<ParsedImportRow[]> {
  const parsed = rows.map((row) => validateImportRow(row.raw, row.number));
  const counts = new Map<string, number>();
  for (const row of parsed)
    if (row.externalId)
      counts.set(row.externalId, (counts.get(row.externalId) ?? 0) + 1);
  const existing = new Set(
    (
      await tx.client.query<{ id: string }>(
        "SELECT external_id AS id FROM treido.catalogue_external_ids WHERE seller_id=$1 AND external_id=ANY($2::text[])",
        [sellerId, [...counts.keys()]],
      )
    ).rows.map((row) => row.id),
  );
  for (const row of parsed)
    if (row.externalId) {
      if ((counts.get(row.externalId) ?? 0) > 1)
        row.errors.push({
          field: "external_id",
          code: "duplicate_external_id",
        });
      if (existing.has(row.externalId))
        row.errors.push({ field: "external_id", code: "already_imported" });
    }
  return parsed;
}
