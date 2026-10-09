import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(),
  save: vi.fn(),
  read: vi.fn(),
  intent: vi.fn(),
  access: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../server/identity/clerk.server", () => ({
  requireVerifiedIdentity: mocks.identity,
}));
vi.mock("../../server/db/database", () => ({ getDatabase: mocks.database }));
vi.mock("./setup.server", () => ({
  saveSellerSetup: mocks.save,
  readSellerSetup: mocks.read,
  completeSignupIntent: mocks.intent,
}));
vi.mock("./workspace-access.server", () => ({
  readWorkspaceAccess: mocks.access,
}));
import {
  completeSignupIntentAction,
  readSellerSetupAction,
  refreshSellerAccessAction,
  saveSellerSetupAction,
} from "./setup-actions";
import { SellerError } from "./errors";
const input = () => ({
  sellerId: randomUUID(),
  requestId: randomUUID(),
  expectedRevision: 0,
  section: "details" as const,
  submit: false,
  payload: { name: "Store", description: "", locality: "" },
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue({ subject: "user_verified" });
  mocks.database.mockReturnValue({ adapter: "database" });
});
describe("setup action authentication boundary (PostgreSQL tested separately)", () => {
  it("rechecks authentication for saves, reads, restored views and intent", async () => {
    mocks.identity.mockRejectedValue(new SellerError("UNAUTHENTICATED"));
    for (const operation of [
      () => saveSellerSetupAction(input()),
      () => readSellerSetupAction(randomUUID()),
      () => refreshSellerAccessAction("/app/sellers/" + randomUUID() + "/team"),
      () => refreshSellerAccessAction("/app"),
      () => completeSignupIntentAction(null, new FormData()),
    ])
      expect(await operation()).toEqual({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("passes the verified human and selected resource to the command", async () => {
    const command = input();
    mocks.save.mockResolvedValue({ revision: 1 });
    expect(await saveSellerSetupAction(command)).toEqual({
      ok: true,
      data: { revision: 1 },
    });
    expect(mocks.save).toHaveBeenCalledWith(
      { adapter: "database" },
      { subject: "user_verified" },
      command,
    );
  });
  it("passes the full current workspace route and server-verified human to the authority reader", async () => {
    const route =
      "/app/sellers/" + randomUUID() + "/insights?lang=en&dataset=imports";
    const snapshot = { actorSubject: "user_verified", route, sellers: [] };
    mocks.access.mockResolvedValue(snapshot);
    expect(await refreshSellerAccessAction(route)).toEqual({
      ok: true,
      data: snapshot,
    });
    expect(mocks.access).toHaveBeenCalledWith(
      { adapter: "database" },
      { subject: "user_verified" },
      route,
    );
  });
  it("returns current revoked-access and revision-conflict denials", async () => {
    mocks.access.mockRejectedValue(new SellerError("FORBIDDEN"));
    expect(
      await refreshSellerAccessAction("/app/sellers/" + randomUUID() + "/team"),
    ).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
    mocks.save.mockRejectedValue(new SellerError("CONFLICT"));
    expect(await saveSellerSetupAction(input())).toEqual({
      ok: false,
      code: "CONFLICT",
    });
  });
  it("rechecks the human's current status when restoring a view without a selected seller", async () => {
    mocks.access.mockRejectedValue(new SellerError("FORBIDDEN"));
    expect(await refreshSellerAccessAction("/app")).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
    expect(mocks.access).toHaveBeenCalledWith(
      { adapter: "database" },
      { subject: "user_verified" },
      "/app",
    );
    expect(mocks.intent).not.toHaveBeenCalled();
  });
  it("skip wins over a previously selected radio without creating a seller", async () => {
    const form = new FormData();
    form.set("intent", "business");
    form.set("skip", "yes");
    form.set("revision", "0");
    const requestId = randomUUID();
    form.set("requestId", requestId);
    mocks.intent.mockResolvedValue({ intent: null, revision: 1 });
    expect(await completeSignupIntentAction(null, form)).toEqual({
      ok: true,
      data: { intent: null, revision: 1 },
    });
    expect(mocks.intent).toHaveBeenCalledWith(
      { adapter: "database" },
      { subject: "user_verified" },
      { intent: null, expectedRevision: 0, requestId },
    );
  });
  it("does not interpret missing revision as revision zero", async () => {
    const form = new FormData();
    form.set("intent", "buy");
    form.set("requestId", randomUUID());
    expect(await completeSignupIntentAction(null, form)).toEqual({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(mocks.intent).not.toHaveBeenCalled();
  });
  it("does not expose provider errors or return sample success", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.read.mockRejectedValue(new Error("secret URL password"));
      expect(await readSellerSetupAction(randomUUID())).toEqual({
        ok: false,
        code: "NOT_AVAILABLE",
      });
      expect(log).toHaveBeenCalledWith("Treido seller setup unavailable.");
    } finally {
      log.mockRestore();
    }
  });
});
