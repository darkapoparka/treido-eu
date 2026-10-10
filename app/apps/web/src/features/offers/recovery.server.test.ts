import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  query: vi.fn(),
  conversation: vi.fn(),
  seller: vi.fn(),
  allocate: vi.fn(),
  release: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../server/db/database", () => ({
  inTransaction: mocks.transaction,
}));
vi.mock("../library/cursor.server", () => ({
  libraryActorKey: () => "a".repeat(64),
}));
vi.mock("../sellers/persistence.server", () => ({
  authorizeSeller: mocks.seller,
  inputHash: () => "original-input-hash",
}));
vi.mock("../messaging/conversation-access.server", () => ({
  authorizeConversation: mocks.conversation,
}));
vi.mock("../inventory/queries.server", () => ({
  readPublicInventoryInTransaction: vi.fn(),
}));
vi.mock("../inventory/allocations.server", () => ({
  allocateInventory: mocks.allocate,
  releaseAllocation: mocks.release,
}));
vi.mock("./expiry.server", () => ({
  expirePendingOffersInTransaction: vi.fn(),
}));
import { recoverOfferRequest } from "./offers.server";
import { SellerError } from "../sellers/errors";
const id = (last: number) =>
  `00000000-0000-4000-8000-${String(last).padStart(12, "0")}`;
const identity = { subject: "user_synthetic_a" } as VerifiedIdentity,
  database = {} as SellerDatabase;
const mutation = {
  actorKey: "a".repeat(64),
  command: {
    sellerId: null,
    threadId: id(1),
    requestId: id(2),
    expectedRevision: 7,
    operation: { kind: "accept", offerId: id(3) },
  },
};
let revision = 10,
  receipt: { hash: string; revision: number; offerId: string } | null;
beforeEach(() => {
  vi.resetAllMocks();
  revision = 10;
  receipt = { hash: "original-input-hash", revision: 8, offerId: id(3) };
  mocks.transaction.mockImplementation(async (_database, callback) =>
    callback({ client: { query: mocks.query } }),
  );
  mocks.conversation.mockResolvedValue({
    user: { id: id(4) },
    thread: { id: id(1), sellerId: id(5) },
    side: "buyer",
    canBlock: true,
    canReply: false,
  });
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM treido.conversation_threads"))
      return { rows: [{ revision }] };
    if (sql.includes("FROM treido.offer_command_receipts"))
      return { rows: receipt ? [receipt] : [] };
    throw new Error("Unexpected recovery query");
  });
});
describe("immutable offer receipt recovery", () => {
  it("acknowledges the original accepted receipt after later state changes without requiring new negotiation", async () => {
    expect(
      await recoverOfferRequest(database, identity, mutation),
    ).toMatchObject({
      state: "recorded",
      acceptedRevision: 8,
      currentRevision: 10,
      offerId: id(3),
    });
    expect(mocks.allocate).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.query.mock.calls[0][0]).toContain("FOR SHARE");
    expect(mocks.query.mock.calls[1][1]).toEqual([id(1), id(4), id(2)]);
  });
  it("does not convert same-revision absence into proof that a request vanished", async () => {
    receipt = null;
    revision = 7;
    expect(
      await recoverOfferRequest(database, identity, mutation),
    ).toMatchObject({
      state: "unrecorded",
      acceptedRevision: null,
      offerId: null,
    });
  });
  it("can rule out an unrecorded request only after its monotonic revision has advanced", async () => {
    receipt = null;
    expect(
      await recoverOfferRequest(database, identity, mutation),
    ).toMatchObject({ state: "not_applied", currentRevision: 10 });
    revision = 6;
    expect(
      await recoverOfferRequest(database, identity, mutation),
    ).toMatchObject({ state: "unrecorded" });
  });
  it("rejects another payload under the original request identifier", async () => {
    receipt!.hash = "different-original";
    await expect(
      recoverOfferRequest(database, identity, mutation),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("reauthorizes conversation visibility before reading even an old receipt", async () => {
    mocks.conversation.mockRejectedValue(new SellerError("FORBIDDEN"));
    await expect(
      recoverOfferRequest(database, identity, mutation),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("denies a foreign captured human before opening a transaction", async () => {
    await expect(
      recoverOfferRequest(database, identity, {
        ...mutation,
        actorKey: "b".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
