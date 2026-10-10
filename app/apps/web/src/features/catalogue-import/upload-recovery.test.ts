import { describe, expect, it } from "vitest";
import {
  importUploadCommand,
  importUploadJournalKey,
  restoreImportUpload,
  restartCancelledUpload,
} from "./upload-recovery";
const scope = {
  actorSubject: "user_synthetic",
  sellerId: "00000000-0000-4000-8000-000000000001",
  checksum: "a".repeat(64),
  bytes: 1024,
  name: "Каталог.csv",
};
const journal = {
  version: 1,
  ...scope,
  requestId: "00000000-0000-4000-8000-000000000002",
  importId: null,
};
describe("recoverable current-human CSV uploads", () => {
  it("restores the original request before a response supplied an import ID", () => {
    expect(restoreImportUpload(JSON.stringify(journal), scope)).toEqual(
      journal,
    );
  });
  it("does not store CSV contents or accept hidden payload fields", () => {
    expect(
      restoreImportUpload({ ...journal, csv: "name,price" }, scope),
    ).toBeNull();
  });
  it.each([
    null,
    "null",
    "{broken",
    {},
    { ...journal, version: 2 },
    { ...journal, requestId: "invalid" },
    { ...journal, importId: "foreign" },
  ])("ignores unavailable or invalid optional recovery %j", (value) => {
    expect(restoreImportUpload(value, scope)).toBeNull();
  });
  it.each([
    { sellerId: "00000000-0000-4000-8000-000000000099" },
    { actorSubject: "other_human" },
    { checksum: "b".repeat(64) },
    { bytes: 2048 },
    { name: "renamed.csv" },
  ])("isolates a changed human, seller or file %j", (change) => {
    expect(restoreImportUpload(journal, { ...scope, ...change })).toBeNull();
    expect(importUploadJournalKey({ ...scope, ...change })).not.toEqual(
      importUploadJournalKey(scope),
    );
  });
  it("does not change a domain command's receipt input while binding its actor", () => {
    const command = {
      sellerId: scope.sellerId,
      requestId: journal.requestId,
      name: scope.name,
      bytes: scope.bytes,
      checksum: scope.checksum,
    };
    expect(
      importUploadCommand(
        { actorSubject: scope.actorSubject, command },
        scope.actorSubject,
      ),
    ).toBe(command);
    expect(() =>
      importUploadCommand(
        { actorSubject: scope.actorSubject, command },
        "another_human",
      ),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => importUploadCommand(command, scope.actorSubject)).toThrow();
  });
});

it("starts a distinct request only from the exact verified cancelled file and retains immutable old metadata", () => {
  const original = {
    ...journal,
    version: 1 as const,
    importId: "00000000-0000-4000-8000-000000000003",
  };
  const snapshot = {
    id: original.importId,
    sellerId: scope.sellerId,
    sourceHash: scope.checksum,
    sourceBytes: scope.bytes,
    state: "cancelled",
  };
  const requestId = "00000000-0000-4000-8000-000000000004";
  expect(restartCancelledUpload(original, snapshot, requestId)).toEqual({
    ...original,
    requestId,
    importId: null,
  });
  expect(original.importId).toEqual(snapshot.id);
  for (const state of [
    "uploading",
    "validating",
    "review",
    "queued",
    "running",
    "complete",
    "unknown",
  ])
    expect(
      restartCancelledUpload(original, { ...snapshot, state }, requestId),
    ).toBeNull();
  for (const difference of [
    { id: requestId },
    { sellerId: requestId },
    { sourceHash: "b".repeat(64) },
    { sourceBytes: 1 },
  ])
    expect(
      restartCancelledUpload(
        original,
        { ...snapshot, ...difference },
        requestId,
      ),
    ).toBeNull();
  expect(
    restartCancelledUpload(original, snapshot, original.requestId),
  ).toBeNull();
});
