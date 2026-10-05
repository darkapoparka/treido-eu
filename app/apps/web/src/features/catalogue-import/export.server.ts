import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { ownedImport } from "./access.server";
import { importScope, type ImportIssue } from "./model";
import { CSV_COLUMNS, CSV_LIMITS, csvDocument, type CsvRow } from "./csv";
export async function exportImportReport(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const scope = importScope(raw);
  return inTransaction(database, async (tx) => {
    await ownedImport(tx, identity, scope.sellerId, scope.importId);
    const rows = (
      await tx.client.query<{
        number: number;
        raw: CsvRow;
        state: string;
        listingId: string | null;
        errors: ImportIssue[];
      }>(
        'SELECT row_number AS number,raw,state,listing_id AS "listingId",errors FROM treido.catalogue_import_rows WHERE import_id=$1 ORDER BY row_number LIMIT $2',
        [scope.importId, CSV_LIMITS.rows],
      )
    ).rows;
    return {
      name: "treido-import-" + scope.importId + ".csv",
      csv: csvDocument(
        ["row", "state", "listing_id", "errors", ...CSV_COLUMNS],
        rows.map((row) => [
          row.number,
          row.state,
          row.listingId,
          row.errors.map((error) => error.field + ": " + error.code).join("; "),
          ...CSV_COLUMNS.map((key) => row.raw[key] ?? ""),
        ]),
      ),
    };
  });
}
