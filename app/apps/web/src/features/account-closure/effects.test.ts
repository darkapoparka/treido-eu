import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectRow } from "./storage.server";
const calls = vi.hoisted(() => ({
  query: vi.fn(),
  observe: vi.fn(),
  execute: vi.fn(),
  recent: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (_database: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: calls.query } }),
}));
vi.mock("../sellers/persistence.server", () => ({
  inputHash: () => "a".repeat(64),
}));
vi.mock("./storage.server", () => ({
  approvedBinding: async () => ({}),
  effectColumns: "id",
  requireRecent: calls.recent,
}));
vi.mock("./commands.server", () => ({ ownSecurityEffect: vi.fn() }));
vi.mock("./clerk-adapter.server", () => ({
  clerkEffectAdapter: async () => ({
    observe: calls.observe,
    execute: calls.execute,
  }),
}));
vi.mock("./media-adapter.server", () => ({ mediaEffectAdapter: vi.fn() }));
vi.mock("./billing-adapter.server", () => ({ billingEffectAdapter: vi.fn() }));
import { performLifecycleEffect } from "./effects.server";
import { ClosureError } from "./model";
import type { SellerDatabase } from "../../server/db/database";
const identity = Object.freeze({ subject: "user_own" }); // Verified guard is mocked only in this isolated protocol suite.
const database = {} as SellerDatabase; // Isolated adapter protocol; no pool or external transport.
const effect: EffectRow = {
  id: "38b7d7a1-7375-4163-acd2-cf46db755cd6",
  userId: "a664c7ed-4f2a-4e28-8cc9-bec00d15f32b",
  planId: null,
  bindingId: "9e3cc608-ad87-4e9c-aecb-e6741f359583",
  subject: "user_own",
  kind: "session.revoke",
  state: "prepared",
  target: { sessionId: "sess_owned" },
  operationKey: "eaa5d7e3-6b87-46ad-b4eb-dc5dca282fcd",
  firstAttemptAt: null,
  leaseToken: null,
  leaseUntil: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  calls.observe.mockResolvedValue({
    state: "unknown",
    evidence: { status: "active" },
  });
  calls.execute.mockResolvedValue({
    state: "confirmed",
    evidence: { status: "revoked" },
  });
  calls.query.mockImplementation(async (sql: string) =>
    sql.includes("account_claim_effect")
      ? { rows: [{ claim: { claimed: true, execute: true } }] }
      : { rows: [] },
  );
});
describe("isolated effect crash/recovery protocol, without real effects", () => {
  it("a supplied subject without current verified recent identity cannot reach the transport", async () => {
    await expect(
      performLifecycleEffect(database, effect, null),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls.observe).not.toHaveBeenCalled();
    expect(calls.execute).not.toHaveBeenCalled();
  });
  it("recent proof that expires during qualification prevents even the durable first attempt", async () => {
    calls.observe.mockImplementation(async () => {
      calls.recent.mockImplementation(() => {
        throw new ClosureError("RECENT_AUTH_REQUIRED");
      });
      return { state: "unknown", evidence: { status: "active" } };
    });
    await expect(
      performLifecycleEffect(database, effect, null, identity),
    ).rejects.toMatchObject({ code: "RECENT_AUTH_REQUIRED" });
    expect(calls.query).not.toHaveBeenCalled();
    expect(calls.execute).not.toHaveBeenCalled();
  });
  it("a failed authority read prevents the first provider mutation and durable attempt", async () => {
    calls.observe.mockRejectedValue({ status: 403 });
    await expect(
      performLifecycleEffect(database, effect, null, identity),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(calls.query).not.toHaveBeenCalled();
    expect(calls.execute).not.toHaveBeenCalled();
  });
  it("a timeout records unknown; restored authority observes the same original effect without a second mutation", async () => {
    calls.execute.mockRejectedValue(
      new Error("transport timeout after possible effect"),
    );
    expect(await performLifecycleEffect(database, effect, null, identity)).toBe(
      "unknown",
    );
    expect(calls.execute).toHaveBeenCalledTimes(1);
    expect(
      calls.query.mock.calls.some(
        ([sql, args]) =>
          sql.includes("account_record_effect") &&
          args[0] === effect.id &&
          args[2] === "unknown",
      ),
    ).toBe(true);
    calls.query.mockImplementation(async (sql: string) =>
      sql.includes("account_claim_effect")
        ? { rows: [{ claim: { claimed: true, execute: false } }] }
        : { rows: [] },
    );
    calls.observe.mockResolvedValue({
      state: "confirmed",
      evidence: { status: "revoked" },
    });
    expect(
      await performLifecycleEffect(
        database,
        { ...effect, firstAttemptAt: new Date(), state: "unknown" },
        null,
        identity,
      ),
    ).toBe("confirmed");
    expect(calls.execute).toHaveBeenCalledTimes(1);
  });
  it("a concurrent lost claim cannot invoke the provider even if the preliminary read found an active session", async () => {
    calls.query.mockResolvedValue({
      rows: [{ claim: { claimed: false, confirmed: false } }],
    });
    expect(await performLifecycleEffect(database, effect, null, identity)).toBe(
      "pending",
    );
    expect(calls.execute).not.toHaveBeenCalled();
  });
  it("an original effect already confirmed absent is recorded without another mutation", async () => {
    calls.observe.mockResolvedValue({
      state: "confirmed",
      evidence: { status: "absent" },
    });
    expect(await performLifecycleEffect(database, effect, null, identity)).toBe(
      "confirmed",
    );
    expect(calls.execute).not.toHaveBeenCalled();
  });
});
