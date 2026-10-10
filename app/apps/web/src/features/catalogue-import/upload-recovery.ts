import { validId } from "../selling/draft-model";
import { onlyKeys, whole } from "../inventory/model";
import { SellerError } from "../sellers/errors";
import { CSV_LIMITS } from "./csv";

export type ImportUploadJournal = {
  version: 1;
  actorSubject: string;
  sellerId: string;
  requestId: string;
  checksum: string;
  bytes: number;
  name: string;
  importId: string | null;
};
export type ImportUploadScope = Pick<
  ImportUploadJournal,
  "actorSubject" | "sellerId" | "checksum" | "bytes" | "name"
>;
export function importUploadJournalKey(scope: ImportUploadScope) {
  return `treido-import-upload:v1:${scope.actorSubject}:${scope.sellerId}:${scope.checksum}:${scope.bytes}:${encodeURIComponent(scope.name)}`;
}
/** Metadata only. The original CSV remains in the user's selected File and is
 * never copied into browser storage. A reload requires selecting it again. */
export function restoreImportUpload(
  raw: unknown,
  scope: ImportUploadScope,
): ImportUploadJournal | null {
  try {
    const x: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (
      !onlyKeys(x, [
        "version",
        "actorSubject",
        "sellerId",
        "requestId",
        "checksum",
        "bytes",
        "name",
        "importId",
      ]) ||
      x.version !== 1 ||
      x.actorSubject !== scope.actorSubject ||
      x.sellerId !== scope.sellerId ||
      !validId(x.sellerId) ||
      !validId(x.requestId) ||
      x.checksum !== scope.checksum ||
      typeof x.checksum !== "string" ||
      !/^[a-f0-9]{64}$/.test(x.checksum) ||
      x.bytes !== scope.bytes ||
      !whole(x.bytes, 1, CSV_LIMITS.bytes) ||
      x.name !== scope.name ||
      typeof x.name !== "string" ||
      x.name.length > 180 ||
      (x.importId !== null && !validId(x.importId))
    )
      return null;
    return x as ImportUploadJournal;
  } catch {
    return null;
  }
}
/** Keep the existing domain command/hash unchanged while binding the captured
 * client intent to the human authenticated at the public action boundary. */
export function importUploadCommand(
  raw: unknown,
  currentSubject: string,
): unknown {
  if (
    !onlyKeys(raw, ["actorSubject", "command"]) ||
    typeof raw.actorSubject !== "string" ||
    !raw.actorSubject ||
    raw.actorSubject.length > 160 ||
    !raw.command ||
    typeof raw.command !== "object" ||
    Array.isArray(raw.command)
  )
    throw new SellerError("INVALID_INPUT");
  if (raw.actorSubject !== currentSubject) throw new SellerError("FORBIDDEN");
  return raw.command;
}

/** Starting a separate import is allowed only after a fresh authorized read
 * confirms this exact previous file/import was cancelled, never on a timeout. */
export function restartCancelledUpload(
  journal: ImportUploadJournal,
  snapshot: {
    id: string;
    sellerId: string;
    sourceHash: string;
    sourceBytes: number;
    state: string;
  },
  requestId: string,
): ImportUploadJournal | null {
  if (
    !restoreImportUpload(journal, journal) ||
    !validId(requestId) ||
    requestId === journal.requestId ||
    !journal.importId ||
    snapshot.state !== "cancelled" ||
    snapshot.id !== journal.importId ||
    snapshot.sellerId !== journal.sellerId ||
    snapshot.sourceHash !== journal.checksum ||
    snapshot.sourceBytes !== journal.bytes
  )
    return null;
  return { ...journal, requestId, importId: null };
}
