import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { onlyKeys } from "../inventory/model";
import { importSeller, ownedImport, type StoredImport } from "./access.server";
import {
  importScope,
  type ImportSummary,
  type ImportView,
  type ImportRowView,
} from "./model";
import { CSV_LIMITS } from "./csv";
export async function importSummary(
  tx: SellerTransaction,
  job: StoredImport,
): Promise<ImportSummary> {
  const counts = (
    await tx.client.query<{
      created: number;
      ready: number;
      invalid: number;
      selected: number;
    }>(
      "SELECT count(*) FILTER(WHERE state='created')::int AS created,count(*) FILTER(WHERE state='ready')::int AS ready,count(*) FILTER(WHERE state IN ('invalid','failed'))::int AS invalid,count(*) FILTER(WHERE state='ready' AND selected)::int AS selected FROM treido.catalogue_import_rows WHERE import_id=$1",
      [job.id],
    )
  ).rows[0];
  const external = job.jobId
    ? (
        await tx.client.query<{ state: string }>(
          "SELECT state FROM treido.outbox_jobs WHERE seller_id=$1 AND id=$2",
          [job.sellerId, job.jobId],
        )
      ).rows[0]
    : null;
  const stopped =
    ["queued", "processing"].includes(job.state) &&
    !!external &&
    ["dead", "cancelled"].includes(external.state);
  return {
    id: job.id,
    name: job.name,
    state: stopped ? "paused" : job.state,
    revision: job.revision,
    total: job.total,
    ...counts,
    error: stopped ? "worker_unavailable" : job.error,
    createdAt: job.createdAt.toISOString(),
  };
}
export async function readCatalogueImport(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<ImportView> {
  const scope = importScope(raw);
  return inTransaction(database, async (tx) => {
    const { job, limits, context } = await ownedImport(
      tx,
      identity,
      scope.sellerId,
      scope.importId,
    );
    const rows = (
      await tx.client.query<ImportRowView>(
        'SELECT row_number AS number,external_id AS "externalId",raw,payload,inventory,errors,selected,state,listing_id AS "listingId" FROM treido.catalogue_import_rows WHERE import_id=$1 AND row_number>$2 ORDER BY row_number LIMIT $3',
        [job.id, scope.after, CSV_LIMITS.page + 1],
      )
    ).rows;
    const selected = rows.slice(0, CSV_LIMITS.page);
    return {
      ...(await importSummary(tx, job)),
      sellerId: job.sellerId,
      rows: selected,
      after: scope.after,
      nextAfter: rows.length > CSV_LIMITS.page ? selected.at(-1)!.number : null,
      rowLimit: limits.importRows,
      draftsRemaining: Math.max(0, limits.drafts - limits.draftCount),
      canManage: context.capabilities.includes("listing.write"),
      uploaded:
        job.state === "uploading"
          ? (
              await tx.client.query<{ position: number }>(
                "SELECT position FROM treido.catalogue_import_chunks WHERE import_id=$1 ORDER BY position",
                [job.id],
              )
            ).rows.map((row) => row.position)
          : [],
      sourceBytes: job.bytes,
      sourceHash: job.hash,
    };
  });
}
export async function readCatalogueImports(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  if (
    !onlyKeys(raw, ["sellerId", "before"]) ||
    !validId(raw.sellerId) ||
    (raw.before !== undefined && raw.before !== null && !validId(raw.before))
  )
    throw new SellerError("INVALID_INPUT");
  const sellerId = raw.sellerId,
    before = raw.before ?? null;
  return inTransaction(database, async (tx) => {
    const { limits, context } = await importSeller(tx, identity, sellerId);
    const rows = (
      await tx.client.query<{
        id: string;
        name: string;
        state: ImportSummary["state"];
        revision: number;
        total: number;
        createdAt: Date;
        error: string | null;
        created: number;
        ready: number;
        invalid: number;
        selected: number;
      }>(
        "SELECT j.id,j.source_name AS name,CASE WHEN j.state IN ('queued','processing') AND o.state IN ('dead','cancelled') THEN 'paused' ELSE j.state END AS state,j.revision,j.total_rows AS total,j.created_at AS \"createdAt\",j.error_code AS error,c.* FROM treido.catalogue_imports j LEFT JOIN treido.outbox_jobs o ON o.id=j.job_id LEFT JOIN LATERAL (SELECT count(*) FILTER(WHERE state='created')::int AS created,count(*) FILTER(WHERE state='ready')::int AS ready,count(*) FILTER(WHERE state IN ('invalid','failed'))::int AS invalid,count(*) FILTER(WHERE state='ready' AND selected)::int AS selected FROM treido.catalogue_import_rows r WHERE r.import_id=j.id) c ON true WHERE j.seller_id=$1 AND ($2::uuid IS NULL OR (j.created_at,j.id)<(SELECT created_at,id FROM treido.catalogue_imports WHERE seller_id=$1 AND id=$2)) ORDER BY j.created_at DESC,j.id DESC LIMIT 21",
        [sellerId, before],
      )
    ).rows;
    return {
      sellerId,
      rowLimit: limits.importRows,
      draftsRemaining: Math.max(0, limits.drafts - limits.draftCount),
      canManage: context.capabilities.includes("listing.write"),
      items: rows
        .slice(0, 20)
        .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      nextBefore: rows.length > 20 ? rows[19].id : null,
    };
  });
}
export type ImportIndex = Awaited<ReturnType<typeof readCatalogueImports>>;
