import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), bindings: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("../config/backend-bindings.server", () => ({
  requireBackendBindings: mocks.bindings,
}));
import { readVerifiedIdentity, requireVerifiedIdentity } from "./clerk.server";

beforeEach(() => {
  vi.resetAllMocks();
});
describe("Clerk session adapter (SDK boundary unit tests)", () => {
  it("uses the verified session subject and accepts only session tokens", async () => {
    mocks.auth.mockResolvedValue({
      userId: "user_actualsubject",
      sessionId: "sess_verified",
    });
    expect(await requireVerifiedIdentity()).toEqual({
      subject: "user_actualsubject",
    });
    expect(mocks.auth).toHaveBeenCalledWith({
      acceptsToken: "session_token",
      treatPendingAsSignedOut: true,
    });
    expect(mocks.bindings).toHaveBeenCalledOnce();
  });
  it.each([
    { userId: null, sessionId: null },
    { userId: "user_pending", sessionId: null },
  ])("does not authenticate absent/pending sessions: %j", async (session) => {
    mocks.auth.mockResolvedValue(session);
    expect(await readVerifiedIdentity()).toBeNull();
    await expect(requireVerifiedIdentity()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });
  it("does not call the provider with an unbound environment", async () => {
    mocks.bindings.mockImplementation(() => {
      throw new Error("Unbound");
    });
    await expect(readVerifiedIdentity()).rejects.toThrow("Unbound");
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("propagates provider failure without a synthetic identity", async () => {
    mocks.auth.mockRejectedValue(new Error("Provider outage"));
    await expect(readVerifiedIdentity()).rejects.toThrow("Provider outage");
  });
});
