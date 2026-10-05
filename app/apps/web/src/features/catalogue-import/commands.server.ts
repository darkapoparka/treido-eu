import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { inputHash } from "../sellers/persistence.server";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { ownedImport } from "./access.server";
import { importCommand } from "./model";
import { projectImportRows } from "./projection.server";
import type { CsvRow } from "./csv";
export async function cancelImportWork(
  tx: SellerTransaction,
  id: string | null,
) {
  if (!id) return;
  await tx.client.query(
    "UPDATE treido.outbox_jobs SET state='cancelled',dispatch_token=NULL,dispatch_until=NULL WHERE id=$1 AND state IN ('pending','accepted','dead')",
    [id],
  );
  await tx.client.query(
    "UPDATE treido.job_effects SET state='cancelled',execution_token=NULL,execution_until=NULL WHERE job_id=$1 AND state<>'completed'",
    [id],
  );
}
export async function changeCatalogueImport(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = importCommand(raw),
    op = command.operation;
  return inTransaction(database, async (tx) => {
    const { job, user, limits } = await ownedImport(
      tx,
      identity,
      command.sellerId,
      command.importId,
      true,
    );
    const hash = inputHash(command),
      previous = (
        await tx.client.query<{ hash: string; revision: number }>(
          "SELECT input_hash AS hash,accepted_revision AS revision FROM treido.catalogue_import_receipts WHERE import_id=$1 AND actor_id=$2 AND request_id=$3",
          [job.id, user.id, command.requestId],
        )
      ).rows[0];
    if (previous) {
      if (previous.hash !== hash || previous.revision !== job.revision)
        throw new SellerError("CONFLICT");
      return { id: job.id, revision: previous.revision };
    }
    if (command.expectedRevision !== job.revision)
      throw new SellerError("CONFLICT");
    if (op.kind === "cancel") {
      if (["completed", "cancelled"].includes(job.state))
        throw new SellerError("CONFLICT");
      await cancelImportWork(tx, job.jobId);
      await tx.client.query(
        "DELETE FROM treido.catalogue_import_chunks WHERE import_id=$1",
        [job.id],
      );
      await tx.client.query(
        "UPDATE treido.catalogue_imports SET state='cancelled',error_code=NULL WHERE id=$1",
        [job.id],
      );
    } else {
      let editable = ["review", "paused"].includes(job.state);
      if (
        !editable &&
        job.jobId &&
        ["queued", "processing"].includes(job.state)
      ) {
        const worker = (
          await tx.client.query<{ state: string; running: boolean }>(
            "SELECT j.state,EXISTS(SELECT 1 FROM treido.job_effects e WHERE e.job_id=j.id AND e.state='running' AND e.execution_until>clock_timestamp()) AS running FROM treido.outbox_jobs j WHERE j.id=$1",
            [job.jobId],
          )
        ).rows[0];
        editable =
          !!worker &&
          ["dead", "cancelled"].includes(worker.state) &&
          !worker.running;
      }
      if (!editable) throw new SellerError("CONFLICT");
      if (["queued", "processing"].includes(job.state)) {
        await cancelImportWork(tx, job.jobId);
        await tx.client.query(
          "UPDATE treido.catalogue_imports SET state='paused' WHERE id=$1",
          [job.id],
        );
      }
      if (op.kind === "choose_valid") {
        const created = (
          await tx.client.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM treido.catalogue_import_rows WHERE import_id=$1 AND state='created'",
            [job.id],
          )
        ).rows[0].count;
        if (
          op.count > Math.max(0, limits.importRows - created) ||
          op.count > Math.max(0, limits.drafts - limits.draftCount)
        )
          throw new SellerError("QUOTA_EXCEEDED");
        await tx.client.query(
          "UPDATE treido.catalogue_import_rows SET selected=false WHERE import_id=$1 AND state<>'created'",
          [job.id],
        );
        await tx.client.query(
          "UPDATE treido.catalogue_import_rows SET selected=true WHERE import_id=$1 AND row_number IN (SELECT row_number FROM treido.catalogue_import_rows WHERE import_id=$1 AND state='ready' ORDER BY row_number LIMIT $2)",
          [job.id, op.count],
        );
      } else if (op.kind === "select") {
        const rows = await tx.client.query(
          "UPDATE treido.catalogue_import_rows SET selected=$3 WHERE import_id=$1 AND row_number=ANY($2::int[]) AND state<>'created' AND (NOT $3 OR state='ready') RETURNING row_number",
          [job.id, op.rows, op.selected],
        );
        if (rows.rowCount !== op.rows.length)
          throw new SellerError("INVALID_INPUT");
      } else if (op.kind === "edit") {
        const changed = await tx.client.query(
          "UPDATE treido.catalogue_import_rows SET raw=$3 WHERE import_id=$1 AND row_number=$2 AND state<>'created' RETURNING row_number",
          [job.id, op.row, JSON.stringify(op.raw)],
        );
        if (changed.rowCount !== 1) throw new SellerError("CONFLICT");
        const rows = (
          await tx.client.query<{ number: number; raw: CsvRow }>(
            "SELECT row_number AS number,raw FROM treido.catalogue_import_rows WHERE import_id=$1 AND state<>'created' ORDER BY row_number",
            [job.id],
          )
        ).rows;
        const projected = await projectImportRows(tx, job.sellerId, rows);
        await tx.client.query(
          "UPDATE treido.catalogue_import_rows r SET external_id=v.external_id,payload=v.payload,inventory=v.inventory,errors=v.errors,state=v.state,selected=CASE WHEN v.state='invalid' THEN false ELSE r.selected END FROM jsonb_to_recordset($2::jsonb) AS v(number integer,external_id text,payload jsonb,inventory jsonb,errors jsonb,state text) WHERE r.import_id=$1 AND r.row_number=v.number",
          [
            job.id,
            JSON.stringify(
              projected.map((row) => ({
                number: row.number,
                external_id: row.externalId,
                payload: row.payload,
                inventory: row.inventory,
                errors: row.errors,
                state: row.errors.length ? "invalid" : "ready",
              })),
            ),
          ],
        );
      } else {
        const counts = (
          await tx.client.query<{ created: number; selected: number }>(
            "SELECT count(*) FILTER(WHERE state='created')::int AS created,count(*) FILTER(WHERE state='ready' AND selected)::int AS selected FROM treido.catalogue_import_rows WHERE import_id=$1",
            [job.id],
          )
        ).rows[0];
        if (!counts.selected) throw new SellerError("INVALID_INPUT");
        if (
          counts.created + counts.selected > limits.importRows ||
          limits.draftCount + counts.selected > limits.drafts
        )
          throw new SellerError("QUOTA_EXCEEDED");
        await cancelImportWork(tx, job.jobId);
        const jobId = await enqueueJob(tx, {
          kind: "catalogue.import",
          sellerId: job.sellerId,
          resourceId: job.id,
          operationKey: randomUUID(),
          actorId: user.id,
          authority: "member",
        });
        await tx.client.query(
          "UPDATE treido.catalogue_imports SET state='queued',job_id=$2,error_code=NULL WHERE id=$1",
          [job.id, jobId],
        );
      }
    }
    const revision = job.revision + 1;
    await tx.client.query(
      "UPDATE treido.catalogue_imports SET revision=$2,updated_at=clock_timestamp() WHERE id=$1",
      [job.id, revision],
    );
    await tx.client.query(
      "INSERT INTO treido.catalogue_import_receipts(seller_id,import_id,actor_id,request_id,input_hash,accepted_revision) VALUES($1,$2,$3,$4,$5,$6)",
      [job.sellerId, job.id, user.id, command.requestId, hash, revision],
    );
    return { id: job.id, revision };
  });
}
