import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(),
  send: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../server/identity/clerk.server", () => ({
  requireVerifiedIdentity: mocks.identity,
}));
vi.mock("../../server/db/database", () => ({ getDatabase: mocks.database }));
vi.mock("./reply.server", () => ({ sendRecoverableReply: mocks.send }));
import { sendRecoverableReplyAction } from "./reply-actions";
import { SellerError } from "../sellers/errors";
beforeEach(() => vi.resetAllMocks());
describe("recoverable reply action authority", () => {
  it("authenticates before database initialization and preserves unresolved auth failure", async () => {
    mocks.identity.mockRejectedValue(new SellerError("UNAUTHENTICATED"));
    const result = await sendRecoverableReplyAction({});
    expect(result).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
      outcome: "unresolved",
    });
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("passes the current verified identity and unchanged command to persistence", async () => {
    const actor = { subject: "A" },
      database = { test: "db" },
      command = { requestId: "original" };
    mocks.identity.mockResolvedValue(actor);
    mocks.database.mockReturnValue(database);
    const receipt = { id: "original-message", sequence: 1, recovered: true };
    mocks.send.mockResolvedValue(receipt);
    expect(await sendRecoverableReplyAction(command)).toEqual({
      ok: true,
      data: receipt,
    });
    expect(mocks.identity.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.database.mock.invocationCallOrder[0],
    );
    expect(mocks.send).toHaveBeenCalledWith(database, actor, command);
  });
  it("keeps provider failures unresolved and excludes original details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.identity.mockResolvedValue({ subject: "A" });
    mocks.database.mockImplementation(() => {
      throw Error("private-sentinel");
    });
    const result = await sendRecoverableReplyAction({});
    expect(result).toEqual({
      ok: false,
      code: "NOT_AVAILABLE",
      outcome: "unresolved",
    });
    expect(JSON.stringify(result)).not.toContain("private-sentinel");
    vi.restoreAllMocks();
  });
});
