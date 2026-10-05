import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectRow, LifecycleBinding } from "./storage.server";
const api = vi.hoisted(() => ({
  instance: vi.fn(),
  session: vi.fn(),
  revoke: vi.fn(),
  user: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    instance: { get: api.instance },
    sessions: { getSession: api.session, revokeSession: api.revoke },
    users: { getUser: api.user, deleteUser: api.remove },
  }),
}));
vi.mock("../../server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: "test",
    identity: { applicationId: "app_isolated", mode: "test" },
  }),
}));
vi.mock("./storage.server", () => ({
  requireRecent: vi.fn(),
  sessionRef: (subject: string, id: string) => subject + ":" + id,
}));
import { clerkEffectAdapter } from "./clerk-adapter.server";
const binding: LifecycleBinding = {
  id: "3ad9067d-ebef-44ad-9c2a-9a5e628293fe",
  environment: "test",
  applicationId: "app_isolated",
  clerkInstanceId: "ins_isolated",
  clerkMode: "test",
  mediaScope: null,
  mediaUnversioned: false,
  stripeAccount: null,
  stripeMode: null,
  stripeApplicationId: null,
  assistantLifecycleVersion: "test",
  aftercareLifecycleVersion: "test",
  securityEnabled: true,
  closureEnabled: true,
};
function effect(kind: EffectRow["kind"] = "session.revoke"): EffectRow {
  return {
    id: "5b50fbc0-7746-4c08-bf7c-e5ffb9a71b6a",
    userId: "f4b127a5-5e2f-49bb-98dd-4f1dfcb30a10",
    planId: null,
    kind,
    state: "prepared",
    target:
      kind === "session.revoke"
        ? { sessionId: "sess_owned" }
        : { subject: "user_owner" },
    bindingId: binding.id,
    subject: "user_owner",
    operationKey: "c1d3a7d0-9648-4a43-a5f8-9be97a0c5f15",
    firstAttemptAt: null,
    leaseToken: null,
    leaseUntil: null,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  api.instance.mockResolvedValue({
    id: "ins_isolated",
    environmentType: "development",
  });
  api.session.mockResolvedValue({
    id: "sess_owned",
    userId: "user_owner",
    status: "active",
  });
  api.user.mockResolvedValue({ id: "user_owner" });
});
describe("isolated Clerk adapter ownership and uncertainty; no real provider acceptance", () => {
  it("denies a foreign session before mutation even when the local intent points to it", async () => {
    api.session.mockResolvedValue({ userId: "user_foreign", status: "active" });
    await expect(clerkEffectAdapter(binding, effect())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(api.revoke).not.toHaveBeenCalled();
  });
  it("rejects an unintended instance or mode before any session mutation", async () => {
    api.instance.mockResolvedValue({
      id: "ins_foreign",
      environmentType: "development",
    });
    await expect(clerkEffectAdapter(binding, effect())).rejects.toMatchObject({
      code: "BINDING_REQUIRED",
    });
    expect(api.revoke).not.toHaveBeenCalled();
  });
  it("an uncertain original revocation is reconciled by an owned GET without another revoke", async () => {
    const original = {
      ...effect(),
      firstAttemptAt: new Date(),
      state: "unknown" as const,
    };
    const adapter = await clerkEffectAdapter(binding, original);
    api.session.mockResolvedValue({ userId: "user_owner", status: "revoked" });
    expect((await adapter.observe()).state).toBe("confirmed");
    expect(api.revoke).not.toHaveBeenCalled();
  });
  it("a still-active session stays unknown after a timeout; a GET never manufactures success", async () => {
    const adapter = await clerkEffectAdapter(binding, {
      ...effect(),
      firstAttemptAt: new Date(),
      state: "unknown",
    });
    expect((await adapter.observe()).state).toBe("unknown");
    expect(api.revoke).not.toHaveBeenCalled();
  });
  it("permission failures do not become absence/deletion success", async () => {
    const adapter = await clerkEffectAdapter(binding, {
      ...effect("identity.delete"),
      firstAttemptAt: new Date(),
    });
    api.user.mockRejectedValue({ status: 403 });
    await expect(adapter.observe()).rejects.toEqual({ status: 403 });
    expect(api.remove).not.toHaveBeenCalled();
  });
  it("the verified original instance may confirm absence through an authoritative 404", async () => {
    const adapter = await clerkEffectAdapter(binding, {
      ...effect("identity.delete"),
      firstAttemptAt: new Date(),
    });
    api.user.mockRejectedValue({ status: 404 });
    expect((await adapter.observe()).state).toBe("confirmed");
    expect(api.remove).not.toHaveBeenCalled();
  });
});
