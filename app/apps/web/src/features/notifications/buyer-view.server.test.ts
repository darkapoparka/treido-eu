import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const source = vi.hoisted(() => ({
  configured: vi.fn(),
  identity: vi.fn(),
  database: vi.fn(),
  feed: vi.fn(),
  decisions: vi.fn(),
}));
vi.mock("../sellers/backend-status.server", () => ({
  backendConfigured: source.configured,
}));
vi.mock("../../server/identity/clerk.server", () => ({
  readVerifiedIdentity: source.identity,
}));
vi.mock("../../server/db/database", () => ({ getDatabase: source.database }));
vi.mock("./queries.server", () => ({ readNotificationFeed: source.feed }));
vi.mock("../trust/decision-updates.server", () => ({
  readDecisionUpdates: source.decisions,
}));
import { readBuyerNotifications } from "./buyer-view.server";
import { SellerError } from "../sellers/errors";
beforeEach(() => {
  vi.clearAllMocks();
  source.configured.mockReturnValue(true);
  source.identity.mockResolvedValue(null);
  source.database.mockReturnValue({ pool: {} });
});
it("rejects invalid query before identity/database, and never converts a malformed private selector to an empty result", async () => {
  await expect(readBuyerNotifications({ filter: "wrong" })).rejects.toThrow(
    "INVALID_INPUT",
  );
  expect(source.identity).not.toHaveBeenCalled();
  expect(source.database).not.toHaveBeenCalled();
});
it("distinguishes missing bindings, verified guest, and identity failure without querying private feeds", async () => {
  source.configured.mockReturnValue(false);
  expect(await readBuyerNotifications({})).toEqual({ state: "unavailable" });
  source.configured.mockReturnValue(true);
  expect(await readBuyerNotifications({})).toEqual({ state: "guest" });
  expect(source.feed).not.toHaveBeenCalled();
  expect(source.decisions).not.toHaveBeenCalled();
  source.identity.mockRejectedValue(new Error("sensitive auth detail"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await readBuyerNotifications({})).toEqual({ state: "unavailable" });
  expect(log).toHaveBeenCalledExactlyOnceWith(
    "Buyer notifications unavailable.",
  );
  log.mockRestore();
});
it("uses verified actor and validated buyer query for both existing real projections", async () => {
  const identity = { subject: "actual" };
  source.identity.mockResolvedValue(identity);
  const feed = { items: [{ id: "real-message" }] },
    decisions = { available: true, items: [] };
  source.feed.mockResolvedValue(feed);
  source.decisions.mockResolvedValue(decisions);
  expect(
    await readBuyerNotifications({
      filter: "unread",
      kind: "message",
      q: " actual ",
      before: "cursor",
    }),
  ).toEqual({ state: "ready", subject: "actual", feed, decisions });
  expect(source.feed).toHaveBeenCalledWith(
    source.database.mock.results[0].value,
    identity,
    {
      sellerId: null,
      filter: "unread",
      kind: "message",
      q: "actual",
      before: "cursor",
    },
  );
  expect(source.decisions).toHaveBeenCalledWith(
    source.database.mock.results[0].value,
    identity,
    null,
  );
});
it("a failed private projection remains unavailable, never a fixture or successful empty feed", async () => {
  source.identity.mockResolvedValue({ subject: "actual" });
  source.feed.mockRejectedValue(new Error("private database detail"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await readBuyerNotifications({})).toEqual({ state: "unavailable" });
  expect(source.decisions).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledExactlyOnceWith(
    "Buyer notifications unavailable.",
  );
  log.mockRestore();
});
it("retains the existing page denial boundary for revoked access and invalid cursors", async () => {
  source.identity.mockResolvedValue({ subject: "actual" });
  for (const code of ["FORBIDDEN", "NOT_FOUND", "INVALID_INPUT"] as const) {
    source.feed.mockRejectedValue(new SellerError(code));
    await expect(readBuyerNotifications({})).rejects.toMatchObject({ code });
  }
  expect(source.decisions).not.toHaveBeenCalled();
});
