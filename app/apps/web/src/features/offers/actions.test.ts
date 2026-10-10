import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), database: vi.fn(), read: vi.fn(), change: vi.fn(), recover: vi.fn() }));
vi.mock("../../server/db/database", () => ({ getDatabase: mocks.database }));
vi.mock("../../server/identity/clerk.server", () => ({ requireVerifiedIdentity: mocks.identity }));
vi.mock("../library/cursor.server", () => ({ libraryActorKey: () => "a".repeat(64) }));
vi.mock("./offers.server", () => ({ readOffers: mocks.read, changeOffer: mocks.change, recoverOfferRequest: mocks.recover }));
import { changeOfferAction, readOffersAction, recoverOfferAction } from "./actions";
import { SellerError } from "../sellers/errors";
const id = (last: number) => `00000000-0000-4000-8000-${String(last).padStart(12, "0")}`;
const identity = { subject: "user_synthetic_a" }, database = { synthetic: true };
const command = { sellerId: null, threadId: id(1), requestId: id(2), expectedRevision: 7, operation: { kind: "accept", offerId: id(3) } };
const mutation = { actorKey: "a".repeat(64), command };
beforeEach(() => {
  vi.resetAllMocks(); mocks.identity.mockResolvedValue(identity); mocks.database.mockReturnValue(database);
  mocks.change.mockResolvedValue({ revision: 8, offerId: id(3) }); mocks.read.mockResolvedValue({ actorKey: mutation.actorKey, threadId: id(1), revision: 8 });
  mocks.recover.mockResolvedValue({ actorKey: mutation.actorKey, threadId: id(1), sellerId: null, requestId: id(2), state: "recorded", currentRevision: 10, acceptedRevision: 8, offerId: id(3) });
});
describe("offer actions bind current identity before persistence", () => {
  it.each([readOffersAction, changeOfferAction, recoverOfferAction])("does not initialize persistence before identity has resolved", async (action) => {
    let finish!: (value: typeof identity) => void;
    mocks.identity.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const pending = action(mutation);
    expect(mocks.database).not.toHaveBeenCalled(); finish(identity); await pending;
  });
  it.each([changeOfferAction, recoverOfferAction])("denies another human's captured action before database access", async (action) => {
    expect(await action({ ...mutation, actorKey: "b".repeat(64) })).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.database).not.toHaveBeenCalled(); expect(mocks.change).not.toHaveBeenCalled();
  });
  it("rejects an old unbound public action without applying it", async () => {
    expect(await changeOfferAction(command)).toEqual({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("passes the unchanged original command to allocation and then reads the current view", async () => {
    expect((await changeOfferAction(mutation)).ok).toBe(true);
    expect(mocks.change).toHaveBeenCalledWith(database, identity, command);
    expect(mocks.read).toHaveBeenCalledWith(database, identity, { threadId: id(1), sellerId: null });
  });
  it("keeps a failed post-commit read uncertain rather than returning invented success", async () => {
    mocks.read.mockRejectedValue(new SellerError("NOT_AVAILABLE"));
    expect(await changeOfferAction(mutation)).toEqual({ ok: false, code: "NOT_AVAILABLE" });
    expect(mocks.change).toHaveBeenCalledTimes(1);
  });
  it("recovery reads only the receipt and never repeats the financial command", async () => {
    expect(await recoverOfferAction(mutation)).toMatchObject({ ok: true, data: { state: "recorded", acceptedRevision: 8, currentRevision: 10 } });
    expect(mocks.change).not.toHaveBeenCalled();
    expect(mocks.recover).toHaveBeenCalledWith(database, identity, mutation);
  });
});
