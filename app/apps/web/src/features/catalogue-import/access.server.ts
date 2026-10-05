import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { readFreeCatalogueLimits } from "../sellers/free-catalogue.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import type { ImportState } from "./model";
export type StoredImport = {
  id: string;
  sellerId: string;
  createdBy: string;
  name: string;
  hash: string;
  bytes: number;
  state: ImportState;
  revision: number;
  total: number;
  jobId: string | null;
  error: string | null;
  expiresAt: Date;
  createdAt: Date;
};
export const importColumns =
  'id,seller_id AS "sellerId",created_by AS "createdBy",source_name AS name,source_hash AS hash,source_bytes AS bytes,state,revision,total_rows AS total,job_id AS "jobId",error_code AS error,expires_at AS "expiresAt",created_at AS "createdAt"';
export async function importSeller(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string,
  write = false,
) {
  const access = await authorizeSeller(tx, identity, sellerId, "import.run");
  if (access.seller.kind !== "business") throw new SellerError("FORBIDDEN");
  if (write) await authorizeSeller(tx, identity, sellerId, "listing.write");
  const limits = await readFreeCatalogueLimits(tx, sellerId, "business", write);
  return { ...access, limits };
}
export async function ownedImport(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string,
  importId: string,
  write = false,
) {
  if (!validId(importId)) throw new SellerError("INVALID_INPUT");
  const access = await importSeller(tx, identity, sellerId, write);
  const job = (
    await tx.client.query<StoredImport>(
      "SELECT " +
        importColumns +
        " FROM treido.catalogue_imports WHERE seller_id=$1 AND id=$2 FOR " +
        (write ? "UPDATE" : "SHARE"),
      [sellerId, importId],
    )
  ).rows[0];
  if (!job) throw new SellerError("NOT_FOUND");
  return { ...access, job };
}
