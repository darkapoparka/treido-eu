import { describe, expect, it } from "vitest";
import {
  restoreBillingRecovery,
  type BillingRecoveryCommand,
} from "./recovery-model";
const original: BillingRecoveryCommand = {
  sellerId: "00000000-0000-4000-8000-000000000001",
  actorKey: "a".repeat(64),
  intentId: "00000000-0000-4000-8000-000000000002",
  requestId: "00000000-0000-4000-8000-000000000003",
  expectedRevision: 4,
  operation: "observe",
};
const scope = {
  sellerId: original.sellerId,
  actorKey: original.actorKey,
  intentId: original.intentId,
  operation: original.operation,
};
describe("optional billing recovery storage", () => {
  it.each([undefined, null, "null", "", "{corrupt", "[]", "{}"])(
    "permits a first explicit command with unavailable original state %s",
    (candidate) => {
      expect(restoreBillingRecovery(scope, candidate)).toBeNull();
    },
  );
  it("recovers the exact in-memory command when storage is unavailable", () => {
    expect(restoreBillingRecovery(scope, original, null)).toBe(original);
  });
  it("restores the original request and revision, not a rewritten retry", () => {
    expect(
      restoreBillingRecovery(scope, null, JSON.stringify(original)),
    ).toEqual(original);
    expect(
      restoreBillingRecovery(scope, original, {
        ...original,
        expectedRevision: 20,
      }),
    ).toBe(original);
  });
  it.each([
    { sellerId: "00000000-0000-4000-8000-000000000099" },
    { actorKey: "b".repeat(64) },
    { intentId: "00000000-0000-4000-8000-000000000099" },
    { operation: "abandon" },
    { requestId: "invalid" },
    { expectedRevision: -1 },
    { providerState: "paid" },
  ])("ignores a foreign or malformed persisted original %j", (change) => {
    expect(
      restoreBillingRecovery(scope, { ...original, ...change }),
    ).toBeNull();
  });
  it("falls back to a valid candidate after corrupt state without losing scope", () => {
    expect(
      restoreBillingRecovery(scope, "{broken", JSON.stringify(original)),
    ).toEqual(original);
  });
});
