"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerErrorCode } from "../sellers/errors";
import { validateJobBindings } from "../../server/jobs/bindings";
import { CsvError } from "./csv";
import {
  createImportUpload,
  appendImportChunk,
  finishImportUpload,
} from "./upload.server";
import { readCatalogueImport, readCatalogueImports } from "./queries.server";
import { changeCatalogueImport } from "./commands.server";
import { exportImportReport } from "./export.server";
function failure(error: unknown): {
  ok: false;
  code: SellerErrorCode;
  detail?: CsvError["code"];
} {
  if (error instanceof CsvError)
    return { ok: false, code: "INVALID_INPUT", detail: error.code };
  if (!(error instanceof SellerError))
    console.error("Catalogue import is unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  };
}
export async function createImportUploadAction(input: unknown) {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: await createImportUpload(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function appendImportChunkAction(input: unknown) {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: await appendImportChunk(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function finishImportUploadAction(input: unknown) {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: await finishImportUpload(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readCatalogueImportAction(input: unknown) {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: await readCatalogueImport(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readCatalogueImportsAction(input: unknown) {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: await readCatalogueImports(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeCatalogueImportAction(input: unknown) {
  try {
    const actor = await requireVerifiedIdentity();
    if (
      input &&
      typeof input === "object" &&
      "operation" in input &&
      input.operation &&
      typeof input.operation === "object" &&
      "kind" in input.operation &&
      input.operation.kind === "start" &&
      !validateJobBindings(process.env).ok
    )
      throw new SellerError("NOT_AVAILABLE");
    return {
      ok: true as const,
      data: await changeCatalogueImport(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function exportImportReportAction(input: unknown) {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true as const,
      data: await exportImportReport(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
