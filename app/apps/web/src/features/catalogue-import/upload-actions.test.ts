import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), database: vi.fn(), create: vi.fn(), append: vi.fn(), finish: vi.fn() }));
vi.mock("../../server/db/database", () => ({ getDatabase: mocks.database }));
vi.mock("../../server/identity/clerk.server", () => ({ requireVerifiedIdentity: mocks.identity }));
vi.mock("./upload.server", () => ({ createImportUpload: mocks.create, appendImportChunk: mocks.append, finishImportUpload: mocks.finish }));
vi.mock("./queries.server", () => ({ readCatalogueImport: vi.fn(), readCatalogueImports: vi.fn() }));
vi.mock("./commands.server", () => ({ changeCatalogueImport: vi.fn() }));
vi.mock("./export.server", () => ({ exportImportReport: vi.fn() }));
import { appendImportChunkAction, createImportUploadAction, finishImportUploadAction } from "./actions";
const identity = { subject: "user_synthetic" }, database = { synthetic: true }, command = { sellerId: "00000000-0000-4000-8000-000000000001" };
const input = { actorSubject: identity.subject, command };
beforeEach(() => { vi.resetAllMocks(); mocks.identity.mockResolvedValue(identity); mocks.database.mockReturnValue(database); });
describe("CSV upload action identity boundary", () => {
  it.each([createImportUploadAction, appendImportChunkAction, finishImportUploadAction])("rejects another captured human before persistence", async (action) => {
    expect(await action({ ...input, actorSubject: "another_human" })).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it.each([createImportUploadAction, appendImportChunkAction, finishImportUploadAction])("finishes identity verification before resolving the database", async (action) => {
    let done!: (value: typeof identity) => void;
    mocks.identity.mockReturnValue(new Promise((resolve) => { done = resolve; }));
    const pending = action(input); expect(mocks.database).not.toHaveBeenCalled(); done(identity); await pending;
  });
  it("passes the unchanged original request through create, append and finish", async () => {
    await createImportUploadAction(input); await appendImportChunkAction(input); await finishImportUploadAction(input);
    for (const method of [mocks.create, mocks.append, mocks.finish]) expect(method).toHaveBeenCalledWith(database, identity, command);
  });
});
