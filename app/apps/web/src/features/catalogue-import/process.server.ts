import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type {
  EffectContext,
  EffectResult,
} from "../../server/jobs/execution.server";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { SellerError } from "../sellers/errors";
import { createDraftInTransaction } from "../selling/drafts.server";
import { changeInventoryInTransaction } from "../inventory/commands.server";
import { ownedImport } from "./access.server";
import { validateImportRow, type ImportIssue } from "./model";
import { CSV_LIMITS, type CsvRow } from "./csv";
/** Each selected row commits its normal draft, inventory, external ID and result together.
 * A crash can replay a batch, but never recreate already-acknowledged rows. */
export async function processCatalogueImport(
  database: SellerDatabase,
  effect: EffectContext,
): Promise<EffectResult> {
  if (
    effect.kind !== "catalogue.import" ||
    effect.authority !== "member" ||
    !effect.actorId
  )
    throw new SellerError("FORBIDDEN");
  const human = (
    await database.pool.query<{ subject: string }>(
      "SELECT clerk_subject AS subject FROM treido.users WHERE id=$1",
      [effect.actorId],
    )
  ).rows[0];
  if (!human) throw new SellerError("FORBIDDEN");
  const identity = { subject: human.subject };
  for (let iteration = 0; iteration < CSV_LIMITS.batch; iteration++) {
    const more = await inTransaction(database, async (tx) => {
      const { job, limits } = await ownedImport(
        tx,
        identity,
        effect.sellerId,
        effect.resourceId,
        true,
      );
      if (
        job.jobId !== effect.id ||
        !["queued", "processing"].includes(job.state)
      )
        return false;
      const live = await tx.client.query(
        "SELECT j.id FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.id=$1 AND j.generation=$2 AND j.state IN ('pending','accepted') AND e.state='running' AND e.execution_token=$3 AND e.execution_until>clock_timestamp()",
        [effect.id, effect.generation, effect.executionToken],
      );
      if (live.rowCount !== 1) throw new SellerError("CONFLICT");
      const row = (
        await tx.client.query<{
          number: number;
          raw: CsvRow;
          requestId: string;
        }>(
          "SELECT row_number AS number,raw,draft_request_id AS \"requestId\" FROM treido.catalogue_import_rows WHERE import_id=$1 AND selected AND state='ready' ORDER BY row_number LIMIT 1 FOR UPDATE",
          [job.id],
        )
      ).rows[0];
      if (!row) return false;
      const count = (
        await tx.client.query<{ value: number }>(
          "SELECT count(*)::int AS value FROM treido.catalogue_import_rows WHERE import_id=$1 AND state='created'",
          [job.id],
        )
      ).rows[0].value;
      if (count >= limits.importRows || limits.draftCount >= limits.drafts) {
        await tx.client.query(
          "UPDATE treido.catalogue_imports SET state='paused',error_code='quota_exceeded',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
          [job.id],
        );
        return false;
      }
      const parsed = validateImportRow(row.raw, row.number);
      const exists = parsed.externalId
        ? (
            await tx.client.query(
              "SELECT listing_id FROM treido.catalogue_external_ids WHERE seller_id=$1 AND external_id=$2",
              [job.sellerId, parsed.externalId],
            )
          ).rowCount
        : 0;
      if (exists)
        parsed.errors.push({ field: "external_id", code: "already_imported" });
      const fail = async (errors: ImportIssue[]) => {
        await tx.client.query(
          "UPDATE treido.catalogue_import_rows SET state='failed',errors=$3 WHERE import_id=$1 AND row_number=$2",
          [job.id, row.number, JSON.stringify(errors)],
        );
        await tx.client.query(
          "UPDATE treido.catalogue_imports SET state='processing',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
          [job.id],
        );
      };
      if (parsed.errors.length || !parsed.payload || !parsed.externalId) {
        await fail(
          parsed.errors.length
            ? parsed.errors
            : [{ field: "row", code: "invalid" }],
        );
        return true;
      }
      await tx.client.query("SAVEPOINT import_row");
      try {
        const draft = await createDraftInTransaction(
          tx,
          identity,
          job.sellerId,
          row.requestId,
          parsed.payload,
        );
        if (parsed.inventory) {
          const stock = parsed.inventory;
          const setup = await changeInventoryInTransaction(tx, identity, {
            sellerId: job.sellerId,
            listingId: draft.id,
            requestId: randomUUID(),
            expectedRevision: 0,
            operation: {
              kind: "setup",
              mode: stock.mode,
              onHand: stock.quantity,
              sellerSku: stock.sku,
            },
          });
          if (Object.keys(stock.options).length)
            await changeInventoryInTransaction(tx, identity, {
              sellerId: job.sellerId,
              listingId: draft.id,
              requestId: randomUUID(),
              expectedRevision: setup.revision,
              operation: {
                kind: "variant",
                skuId: setup.skuId,
                sellerSku: stock.sku,
                options: stock.options,
                priceMinor: null,
              },
            });
        }
        await tx.client.query(
          "INSERT INTO treido.catalogue_external_ids(seller_id,external_id,listing_id,import_id) VALUES($1,$2,$3,$4)",
          [job.sellerId, parsed.externalId, draft.id, job.id],
        );
        await tx.client.query(
          "UPDATE treido.catalogue_import_rows SET state='created',listing_id=$3,errors='[]' WHERE import_id=$1 AND row_number=$2",
          [job.id, row.number, draft.id],
        );
        await tx.client.query(
          "UPDATE treido.catalogue_imports SET state='processing',revision=revision+1,error_code=NULL,updated_at=clock_timestamp() WHERE id=$1",
          [job.id],
        );
        await tx.client.query("RELEASE SAVEPOINT import_row");
      } catch (error) {
        await tx.client.query("ROLLBACK TO SAVEPOINT import_row");
        await tx.client.query("RELEASE SAVEPOINT import_row");
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        if (code === "QUOTA_EXCEEDED") {
          await tx.client.query(
            "UPDATE treido.catalogue_imports SET state='paused',error_code='quota_exceeded',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
            [job.id],
          );
          return false;
        }
        if (
          code === "23505" ||
          code === "INVALID_INPUT" ||
          code === "CONFLICT"
        ) {
          await fail([
            { field: code === "23505" ? "sku" : "row", code: "invalid" },
          ]);
          return true;
        }
        throw error;
      }
      return true;
    });
    if (!more) break;
  }
  return {
    resultId: effect.resourceId,
    lock: async (tx) => {
      const { job } = await ownedImport(
        tx,
        identity,
        effect.sellerId,
        effect.resourceId,
        true,
      );
      if (
        job.jobId !== effect.id ||
        !["queued", "processing", "paused"].includes(job.state)
      )
        throw new SellerError("CONFLICT");
    },
    apply: async (tx) => {
      const job = (
        await tx.client.query<{ state: string }>(
          "SELECT state FROM treido.catalogue_imports WHERE id=$1",
          [effect.resourceId],
        )
      ).rows[0];
      if (job.state === "paused") return;
      const counts = (
        await tx.client.query<{ pending: number; failed: number }>(
          "SELECT count(*) FILTER(WHERE selected AND state='ready')::int AS pending,count(*) FILTER(WHERE selected AND state='failed')::int AS failed FROM treido.catalogue_import_rows WHERE import_id=$1",
          [effect.resourceId],
        )
      ).rows[0];
      if (counts.pending) {
        const next = await enqueueJob(tx, {
          kind: "catalogue.import",
          sellerId: effect.sellerId,
          resourceId: effect.resourceId,
          operationKey: randomUUID(),
          actorId: effect.actorId,
          authority: "member",
        });
        await tx.client.query(
          "UPDATE treido.catalogue_imports SET state='queued',job_id=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
          [effect.resourceId, next],
        );
      } else
        await tx.client.query(
          "UPDATE treido.catalogue_imports SET state=$2,error_code=$3,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
          [
            effect.resourceId,
            counts.failed ? "paused" : "completed",
            counts.failed ? "rows_failed" : null,
          ],
        );
    },
  };
}
/** Server-scheduled retention of never-finished CSV bytes; not a listing/media deletion. */
export async function expireImportUploads(database: SellerDatabase) {
  return inTransaction(database, async (tx) => {
    const rows = (
      await tx.client.query<{ id: string }>(
        "SELECT id FROM treido.catalogue_imports WHERE state='uploading' AND expires_at<=clock_timestamp() ORDER BY expires_at,id LIMIT 20 FOR UPDATE SKIP LOCKED",
      )
    ).rows;
    if (!rows.length) return { expired: 0 };
    const ids = rows.map((row) => row.id);
    await tx.client.query(
      "DELETE FROM treido.catalogue_import_chunks WHERE import_id=ANY($1::uuid[])",
      [ids],
    );
    await tx.client.query(
      "UPDATE treido.catalogue_imports SET state='cancelled',error_code='upload_expired',revision=revision+1,updated_at=clock_timestamp() WHERE id=ANY($1::uuid[])",
      [ids],
    );
    return { expired: ids.length };
  });
}
