import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { onlyKeys, whole, boundedText } from "../inventory/model";
import {
  importSeller,
  ownedImport,
  importColumns,
  type StoredImport,
} from "./access.server";
import { CSV_LIMITS, CsvError, parseCsv } from "./csv";
import { projectImportRows } from "./projection.server";
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export async function createImportUpload(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  if (
    !onlyKeys(raw, ["sellerId", "requestId", "name", "bytes", "checksum"]) ||
    !validId(raw.sellerId) ||
    !validId(raw.requestId) ||
    !whole(raw.bytes, 1, CSV_LIMITS.bytes) ||
    typeof raw.checksum !== "string" ||
    !/^[0-9a-f]{64}$/.test(raw.checksum)
  )
    throw new SellerError("INVALID_INPUT");
  const input = {
    sellerId: raw.sellerId,
    requestId: raw.requestId,
    bytes: raw.bytes,
    checksum: raw.checksum,
  };
  const name = boundedText(raw.name, 180, 1);
  if (!/\.csv$/i.test(name) || /[\/\\]/.test(name))
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const access = await importSeller(tx, identity, input.sellerId, true);
    const existing = (
      await tx.client.query<StoredImport>(
        "SELECT " +
          importColumns +
          " FROM treido.catalogue_imports WHERE seller_id=$1 AND created_by=$2 AND request_id=$3 FOR UPDATE",
        [input.sellerId, access.user.id, input.requestId],
      )
    ).rows[0];
    if (existing) {
      if (
        existing.hash !== input.checksum ||
        existing.bytes !== input.bytes ||
        existing.name !== name ||
        existing.state === "cancelled"
      )
        throw new SellerError("CONFLICT");
      return {
        id: existing.id,
        revision: existing.revision,
        state: existing.state,
      };
    }
    // Technical upload limits are durable and do not change paid-plan entitlement.
    const count = (
      await tx.client.query<{ pending: number; recent: number }>(
        "SELECT count(*) FILTER(WHERE state='uploading' AND expires_at>clock_timestamp())::int AS pending,count(*) FILTER(WHERE created_at>clock_timestamp()-interval '1 hour')::int AS recent FROM treido.catalogue_imports WHERE seller_id=$1",
        [input.sellerId],
      )
    ).rows[0];
    if (count.pending >= 2 || count.recent >= 20)
      throw new SellerError("QUOTA_EXCEEDED");
    const id = randomUUID();
    await tx.client.query(
      "INSERT INTO treido.catalogue_imports(id,seller_id,created_by,request_id,source_name,source_hash,source_bytes) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        input.sellerId,
        access.user.id,
        input.requestId,
        name,
        input.checksum,
        input.bytes,
      ],
    );
    return { id, revision: 1, state: "uploading" as const };
  });
}
export async function appendImportChunk(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  if (
    !onlyKeys(raw, ["sellerId", "importId", "position", "encoded"]) ||
    !validId(raw.sellerId) ||
    !validId(raw.importId) ||
    !whole(
      raw.position,
      0,
      Math.ceil(CSV_LIMITS.bytes / CSV_LIMITS.chunkBytes) - 1,
    ) ||
    typeof raw.encoded !== "string" ||
    raw.encoded.length > Math.ceil(CSV_LIMITS.chunkBytes / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      raw.encoded,
    )
  )
    throw new SellerError("INVALID_INPUT");
  const input = {
    sellerId: raw.sellerId,
    importId: raw.importId,
    position: raw.position,
    encoded: raw.encoded,
  };
  const bytes = Buffer.from(raw.encoded, "base64");
  if (!bytes.length || bytes.toString("base64") !== raw.encoded)
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const { job } = await ownedImport(
      tx,
      identity,
      input.sellerId,
      input.importId,
      true,
    );
    if (job.state !== "uploading" || job.expiresAt.getTime() <= Date.now())
      throw new SellerError("CONFLICT");
    const required = Math.min(
      CSV_LIMITS.chunkBytes,
      job.bytes - input.position * CSV_LIMITS.chunkBytes,
    );
    if (required < 1 || bytes.length !== required)
      throw new SellerError("INVALID_INPUT");
    const checksum = sha(bytes);
    const previous = (
      await tx.client.query<{ checksum: string; encoded: string }>(
        "SELECT checksum,encoded FROM treido.catalogue_import_chunks WHERE import_id=$1 AND position=$2",
        [job.id, input.position],
      )
    ).rows[0];
    if (previous) {
      if (previous.checksum !== checksum || previous.encoded !== input.encoded)
        throw new SellerError("CONFLICT");
      return { position: input.position };
    }
    await tx.client.query(
      "INSERT INTO treido.catalogue_import_chunks(seller_id,import_id,position,bytes,checksum,encoded) VALUES($1,$2,$3,$4,$5,$6)",
      [
        job.sellerId,
        job.id,
        input.position,
        bytes.length,
        checksum,
        input.encoded,
      ],
    );
    return { position: input.position };
  });
}
export async function finishImportUpload(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  if (
    !onlyKeys(raw, ["sellerId", "importId"]) ||
    !validId(raw.sellerId) ||
    !validId(raw.importId)
  )
    throw new SellerError("INVALID_INPUT");
  const input = { sellerId: raw.sellerId, importId: raw.importId };
  return inTransaction(database, async (tx) => {
    const { job } = await ownedImport(
      tx,
      identity,
      input.sellerId,
      input.importId,
      true,
    );
    if (job.state === "review") return { id: job.id, revision: job.revision };
    if (job.state !== "uploading" || job.expiresAt.getTime() <= Date.now())
      throw new SellerError("CONFLICT");
    const chunks = (
      await tx.client.query<{
        position: number;
        encoded: string;
        checksum: string;
        bytes: number;
      }>(
        "SELECT position,encoded,checksum,bytes FROM treido.catalogue_import_chunks WHERE import_id=$1 ORDER BY position",
        [job.id],
      )
    ).rows;
    if (
      chunks.length !== Math.ceil(job.bytes / CSV_LIMITS.chunkBytes) ||
      chunks.some((chunk, index) => chunk.position !== index)
    )
      throw new SellerError("CONFLICT");
    const buffers = chunks.map((chunk) => {
      const bytes = Buffer.from(chunk.encoded, "base64");
      if (bytes.length !== chunk.bytes || sha(bytes) !== chunk.checksum)
        throw new SellerError("INVALID_INPUT");
      return bytes;
    });
    const bytes = Buffer.concat(buffers);
    if (bytes.length !== job.bytes || sha(bytes) !== job.hash)
      throw new SellerError("INVALID_INPUT");
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new CsvError("invalid_encoding");
    }
    const rawRows = parseCsv(text);
    const rows = await projectImportRows(
      tx,
      job.sellerId,
      rawRows.map((raw, index) => ({ number: index + 1, raw })),
    );
    await tx.client.query(
      "INSERT INTO treido.catalogue_import_rows(seller_id,import_id,row_number,external_id,raw,payload,inventory,errors,selected,state,draft_request_id) SELECT $1,$2,r.number,r.external_id,r.raw,r.payload,r.inventory,r.errors,r.selected,r.state,r.request_id FROM jsonb_to_recordset($3::jsonb) AS r(number integer,external_id text,raw jsonb,payload jsonb,inventory jsonb,errors jsonb,selected boolean,state text,request_id uuid)",
      [
        job.sellerId,
        job.id,
        JSON.stringify(
          rows.map((row) => ({
            number: row.number,
            external_id: row.externalId,
            raw: row.raw,
            payload: row.payload,
            inventory: row.inventory,
            errors: row.errors,
            selected: !row.errors.length,
            state: row.errors.length ? "invalid" : "ready",
            request_id: randomUUID(),
          })),
        ),
      ],
    );
    await tx.client.query(
      "UPDATE treido.catalogue_imports SET state='review',total_rows=$2,revision=revision+1,error_code=NULL,updated_at=clock_timestamp() WHERE id=$1",
      [job.id, rows.length],
    );
    await tx.client.query(
      "DELETE FROM treido.catalogue_import_chunks WHERE import_id=$1",
      [job.id],
    );
    return { id: job.id, revision: job.revision + 1 };
  });
}
