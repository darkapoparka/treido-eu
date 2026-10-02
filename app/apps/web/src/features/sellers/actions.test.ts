import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  business: vi.fn(),
  personal: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../server/identity/clerk.server", () => ({
  requireVerifiedIdentity: mocks.identity,
}));
vi.mock("../../server/db/database", () => ({ getDatabase: mocks.database }));
vi.mock("../selling/drafts.server", () => ({
  createListingDraft: mocks.create,
  saveListingDraft: mocks.save,
}));
vi.mock("./persistence.server", () => ({
  createBusinessSeller: mocks.business,
  ensurePersonalSeller: mocks.personal,
}));
import { persistDraftAction, createBusinessAction } from "./actions";
import { SellerError } from "./errors";
import { emptyDraft } from "../selling/draft-model";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue({ subject: "user_verified" });
  mocks.database.mockReturnValue({ marker: "real-adapter-boundary" });
});
const input = () => ({
  sellerId: null,
  draftId: null,
  expectedRevision: 0,
  requestId: randomUUID(),
  payload: emptyDraft,
});
describe("seller actions (unit tests; persistence tested separately in PostgreSQL)", () => {
  it("requires authentication again on each save before opening the database", async () => {
    mocks.identity.mockRejectedValue(new SellerError("UNAUTHENTICATED"));
    expect(await persistDraftAction(input())).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("passes only the verified actor to draft creation", async () => {
    const command = input();
    mocks.create.mockResolvedValue({
      id: randomUUID(),
      sellerId: randomUUID(),
      revision: 1,
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    expect((await persistDraftAction(command)).ok).toBe(true);
    expect(mocks.create).toHaveBeenCalledWith(
      { marker: "real-adapter-boundary" },
      { subject: "user_verified" },
      command,
    );
  });
  it("does not create an item when an edit has no operating seller", async () => {
    expect(
      await persistDraftAction({ ...input(), draftId: randomUUID() }),
    ).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("retains stable denial/conflict results from the transactional use case", async () => {
    mocks.save.mockRejectedValue(new SellerError("CONFLICT"));
    expect(
      await persistDraftAction({
        ...input(),
        sellerId: randomUUID(),
        draftId: randomUUID(),
        expectedRevision: 1,
      }),
    ).toEqual({ ok: false, code: "CONFLICT" });
  });
  it("reports an unavailable save without exposing credentials or sample success", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.create.mockRejectedValue(
        new Error("Sensitive provider URL and password"),
      );
      expect(await persistDraftAction(input())).toEqual({
        ok: false,
        code: "NOT_AVAILABLE",
      });
      expect(log).toHaveBeenCalledWith("Treido seller operation unavailable.");
    } finally {
      log.mockRestore();
    }
  });
  it("does not create a business from an expired sign-in", async () => {
    mocks.identity.mockRejectedValue(new SellerError("UNAUTHENTICATED"));
    const form = new FormData();
    form.set("name", "Business");
    form.set("requestId", randomUUID());
    expect(await createBusinessAction(null, form)).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.business).not.toHaveBeenCalled();
  });
});
