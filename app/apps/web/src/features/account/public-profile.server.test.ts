import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const source = vi.hoisted(() => ({
  configured: vi.fn(),
  identity: vi.fn(),
  database: vi.fn(),
  preferences: vi.fn(),
}));
vi.mock("../sellers/backend-status.server", () => ({
  backendConfigured: source.configured,
}));
vi.mock("../../server/identity/clerk.server", () => ({
  readVerifiedIdentity: source.identity,
}));
vi.mock("../../server/db/database", () => ({ getDatabase: source.database }));
vi.mock("../account-closure/preferences.server", () => ({
  readAccountPreferences: source.preferences,
}));
import { readPublicProfile } from "./public-profile.server";
beforeEach(() => {
  vi.clearAllMocks();
  source.configured.mockReturnValue(true);
  source.identity.mockResolvedValue(null);
  source.database.mockReturnValue({ pool: {} });
});
it("unconfigured and failed identity are unavailable, while a verified signed-out session is guest without private reads", async () => {
  source.configured.mockReturnValue(false);
  expect(await readPublicProfile()).toEqual({ state: "unavailable" });
  expect(source.identity).not.toHaveBeenCalled();
  source.configured.mockReturnValue(true);
  expect(await readPublicProfile()).toEqual({ state: "guest" });
  expect(source.preferences).not.toHaveBeenCalled();
  expect(source.database).not.toHaveBeenCalled();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  source.identity.mockRejectedValue(new Error("sensitive provider detail"));
  expect(await readPublicProfile()).toEqual({ state: "unavailable" });
  expect(log).toHaveBeenCalledExactlyOnceWith(
    "Buyer profile identity unavailable.",
  );
  log.mockRestore();
});
it("only projects actual preferences for the verified subject, without provider contact guesses or storage authority", async () => {
  const identity = { subject: "actual-current-subject" };
  source.identity.mockResolvedValue(identity);
  source.preferences.mockResolvedValue({
    actorKey: "private-authority",
    revision: 9,
    registrationNeeded: false,
    preferences: { locale: "bg", browseScope: "personal" },
  });
  expect(await readPublicProfile()).toEqual({
    state: "member",
    subject: identity.subject,
    preferences: {
      registrationNeeded: false,
      preferences: { locale: "bg", browseScope: "personal" },
    },
    preferencesUnavailable: false,
  });
  expect(source.preferences).toHaveBeenCalledWith(
    source.database.mock.results[0].value,
    identity,
  );
});
it("failed preference storage preserves verified identity and reports unavailable rather than default success", async () => {
  source.identity.mockResolvedValue({ subject: "current" });
  source.preferences.mockRejectedValue(new Error("private database detail"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await readPublicProfile()).toEqual({
    state: "member",
    subject: "current",
    preferences: null,
    preferencesUnavailable: true,
  });
  expect(log).toHaveBeenCalledExactlyOnceWith(
    "Buyer profile preferences unavailable.",
  );
  log.mockRestore();
});
