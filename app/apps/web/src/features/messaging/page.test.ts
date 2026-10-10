import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(),
  inbox: vi.fn(),
  conversation: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("../locale/page-locale.server", () => ({
  pageLocale: async () => "en",
}));
vi.mock("../sellers/backend-status.server", () => ({
  backendConfigured: () => true,
}));
vi.mock("../sellers/page-context.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../sellers/page-context.server")>()),
  requirePageIdentity: state.identity,
}));
vi.mock("../../server/identity/clerk.server", () => ({
  readVerifiedIdentity: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({ getDatabase: state.database }));
vi.mock("./inbox.server", () => ({
  readInbox: state.inbox,
  readConversation: state.conversation,
}));
vi.mock("./inbox", () => ({ InboxWorkspace: "inbox-workspace" }));

import { InboxPage } from "./page";
import { SellerError } from "../sellers/errors";

const actor = { subject: "synthetic-inbox-route-human" };
const database = { adapter: "isolated-route-test" };
const threadId = "10000000-0000-4000-8000-000000000001";
const scope = { sellerId: null };
const page = () =>
  InboxPage({
    scope,
    threadId,
    searchParams: Promise.resolve({ lang: "en" }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  state.identity.mockResolvedValue(actor);
  state.database.mockReturnValue(database);
  state.inbox.mockResolvedValue({ scope });
  state.conversation.mockResolvedValue({ threadId });
});

describe("actual inbox page failure boundary (synthetic session/data)", () => {
  it("passes the verified actor and exact participant scope to both reads", async () => {
    const result = await page();
    expect(result.type).toBe("inbox-workspace");
    expect(result.props.actorSubject).toBe(actor.subject);
    expect(state.identity).toHaveBeenCalledExactlyOnceWith(
      `/messages/${threadId}?lang=en`,
    );
    expect(state.inbox).toHaveBeenCalledExactlyOnceWith(database, actor, {
      ...scope,
      q: "",
      filter: "all",
      cursor: null,
    });
    expect(state.conversation).toHaveBeenCalledExactlyOnceWith(
      database,
      actor,
      {
        ...scope,
        threadId,
      },
    );
  });
  it("awaits identity before database initialization or private reads", async () => {
    state.identity.mockRejectedValue(new Error("verified-sign-in-required"));
    await expect(page()).rejects.toThrow("verified-sign-in-required");
    expect(state.database).not.toHaveBeenCalled();
    expect(state.inbox).not.toHaveBeenCalled();
    expect(state.conversation).not.toHaveBeenCalled();
  });
  it("sanitizes database initialization failures through the private-page boundary", async () => {
    state.database.mockImplementation(() => {
      throw new Error("SYNTHETIC private database initialization detail");
    });
    await expect(page()).rejects.toThrow(
      /^Selling is temporarily unavailable\.$/,
    );
    expect(state.inbox).not.toHaveBeenCalled();
    expect(state.conversation).not.toHaveBeenCalled();
  });
  it("sanitizes private query failures without rendering sample messages", async () => {
    state.inbox.mockRejectedValue(new Error("SYNTHETIC private query detail"));
    await expect(page()).rejects.toThrow(
      /^Selling is temporarily unavailable\.$/,
    );
    expect(state.conversation).not.toHaveBeenCalled();
  });
  it("retains the resource-denial boundary for a foreign conversation", async () => {
    state.conversation.mockRejectedValue(new SellerError("NOT_FOUND"));
    await expect(page()).rejects.toThrow("not-found");
  });
});
