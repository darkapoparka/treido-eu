import { beforeEach, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(),
  send: vi.fn(),
  inbox: vi.fn(),
  conversation: vi.fn(),
  read: vi.fn(),
  block: vi.fn(),
  open: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../server/identity/clerk.server", () => ({
  requireVerifiedIdentity: mocks.identity,
}));
vi.mock("../../server/db/database", () => ({ getDatabase: mocks.database }));
vi.mock("./participants.server", () => ({
  sendConversationMessage: mocks.send,
  openListingConversation: mocks.open,
}));
vi.mock("./inbox.server", () => ({
  readInbox: mocks.inbox,
  readConversation: mocks.conversation,
  markConversationRead: mocks.read,
  setContactBlocked: mocks.block,
}));
import {
  readInboxAction,
  readConversationAction,
  sendMessageAction,
  markReadAction,
  blockContactAction,
  startConversationAction,
} from "./actions";
import { SellerError } from "../sellers/errors";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue({ subject: "user_verified" });
  mocks.database.mockReturnValue({ test: "db" });
});
describe("messaging action transport", () => {
  it("reauthenticates each action before accessing persistence", async () => {
    mocks.identity.mockRejectedValue(new SellerError("UNAUTHENTICATED"));
    for (const action of [
      () => readInboxAction({ sellerId: null }),
      () => readConversationAction({}),
      () => sendMessageAction({}),
      () => markReadAction({}),
      () => blockContactAction({}),
      () => startConversationAction(randomUUID()),
    ])
      expect(await action()).toEqual({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.identity).toHaveBeenCalledTimes(6);
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("passes only the verified actor and exact requested account scope", async () => {
    const input = {
      sellerId: randomUUID(),
      threadId: randomUUID(),
      requestId: randomUUID(),
      body: "Здравейте",
    };
    mocks.send.mockResolvedValue({ id: randomUUID(), sequence: 1 });
    expect((await sendMessageAction(input)).ok).toBe(true);
    expect(mocks.send).toHaveBeenCalledWith(
      { test: "db" },
      { subject: "user_verified" },
      {
        threadId: input.threadId,
        requestId: input.requestId,
        body: input.body,
        attachmentIds: [],
      },
      { sellerId: input.sellerId },
    );
    expect(
      await sendMessageAction({ ...input, actorId: randomUUID() }),
    ).toEqual({ ok: false, code: "INVALID_INPUT" });
  });
  it("never substitutes fake success or leaks a database failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.block.mockRejectedValue(new Error("sensitive connection"));
      expect(await blockContactAction({})).toEqual({
        ok: false,
        code: "NOT_AVAILABLE",
      });
      expect(log).toHaveBeenCalledWith("Treido messaging unavailable.");
    } finally {
      log.mockRestore();
    }
  });
});
