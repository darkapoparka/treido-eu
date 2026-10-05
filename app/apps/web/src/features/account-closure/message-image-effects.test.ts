import { beforeEach, it, expect, vi } from "vitest";
import type { EffectRow } from "./storage.server";
import type { SellerDatabase } from "../../server/db/database";
const calls = vi.hoisted(() => ({
  query: vi.fn(),
  observe: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (_db: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: calls.query } }),
}));
vi.mock("./storage.server", () => ({
  approvedBinding: async () => ({}),
  requireRecent: vi.fn(),
}));
vi.mock("./commands.server", () => ({ ownSecurityEffect: vi.fn() }));
vi.mock("./clerk-adapter.server", () => ({ clerkEffectAdapter: vi.fn() }));
vi.mock("./billing-adapter.server", () => ({ billingEffectAdapter: vi.fn() }));
vi.mock("./media-adapter.server", () => ({
  mediaEffectAdapter: () => ({
    observe: calls.observe,
    execute: calls.execute,
  }),
}));
import { performLifecycleEffect } from "./effects.server";
const effect: EffectRow = {
  id: "a",
  userId: "u",
  planId: "p",
  bindingId: "b",
  subject: "user_own",
  kind: "media.delete",
  state: "unknown",
  target: { ownerKind: "message-image" },
  operationKey: "operation",
  firstAttemptAt: new Date(),
  leaseToken: null,
  leaseUntil: null,
};
const database = {} as SellerDatabase,
  proof = { jobId: "j", executionToken: "x" };
beforeEach(() => {
  vi.resetAllMocks();
  calls.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes("account_claim_effect")
      ? [{ claim: { claimed: true, execute: false } }]
      : [],
  }));
  calls.observe.mockResolvedValue({
    state: "unknown",
    evidence: { status: "present" },
  });
  calls.execute.mockResolvedValue({
    state: "confirmed",
    evidence: { status: "deleted" },
  });
});
it("observes and retries exact-object deletion only after a genuine claim and durable dispatch", async () => {
  expect(await performLifecycleEffect(database, effect, proof)).toBe(
    "confirmed",
  );
  expect(
    calls.query.mock.calls.filter(
      ([sql]) =>
        sql.includes("account_message_image_io") ||
        sql.includes("account_dispatch_message_image"),
    ),
  ).toHaveLength(2);
  expect(calls.query.mock.invocationCallOrder[0]).toBeLessThan(
    calls.observe.mock.invocationCallOrder[0],
  );
  expect(calls.execute).toHaveBeenCalledOnce();
  expect(
    calls.query.mock.calls.findIndex(([sql]) =>
      sql.includes("account_dispatch_message_image"),
    ),
  ).toBeGreaterThan(0);
  expect(
    calls.query.mock.calls.findIndex(([sql]) =>
      sql.includes("account_observe_message_image"),
    ),
  ).toBeLessThan(
    calls.query.mock.calls.findIndex(([sql]) =>
      sql.includes("account_record_effect"),
    ),
  );
});
it("a failed final authority recheck prevents DELETE and cannot record erased", async () => {
  calls.query.mockImplementation(async (sql: string) => {
    if (sql.includes("account_dispatch_message_image"))
      throw Error("Current hold");
    return {
      rows: sql.includes("account_claim_effect")
        ? [{ claim: { claimed: true, execute: false } }]
        : [],
    };
  });
  expect(await performLifecycleEffect(database, effect, proof)).toBe("unknown");
  expect(calls.execute).not.toHaveBeenCalled();
  expect(
    calls.query.mock.calls.some(([sql]) =>
      sql.includes("account_observe_message_image"),
    ),
  ).toBe(true);
  expect(
    calls.query.mock.calls.find(([sql]) =>
      sql.includes("account_record_effect"),
    )?.[1][2],
  ).toBe("unknown");
});
it("unknown storage outcome records unknown and preserves the original retryable artifact", async () => {
  calls.execute.mockRejectedValue(Error("Uncertain provider response"));
  expect(await performLifecycleEffect(database, effect, proof)).toBe("unknown");
});
it("a denied job claim makes no storage IO, including HEAD", async () => {
  calls.query.mockResolvedValue({
    rows: [{ claim: { claimed: false, confirmed: false } }],
  });
  expect(await performLifecycleEffect(database, effect, proof)).toBe("pending");
  expect(calls.observe).not.toHaveBeenCalled();
  expect(calls.execute).not.toHaveBeenCalled();
});

it("retains the real provider fact before an expired acknowledgement rejects", async () => {
  calls.query.mockImplementation(async (sql: string) => {
    if (sql.includes("account_record_effect")) throw Error("Expired lease");
    return {
      rows: sql.includes("account_claim_effect")
        ? [{ claim: { claimed: true, execute: false } }]
        : [],
    };
  });
  await expect(performLifecycleEffect(database, effect, proof)).rejects.toThrow(
    "Expired lease",
  );
  expect(
    calls.query.mock.calls.find(([sql]) =>
      sql.includes("account_observe_message_image"),
    )?.[1][2],
  ).toBe("confirmed");
});
