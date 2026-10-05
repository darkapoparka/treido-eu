import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  refundPortions,
  parseAftercareCommand,
  nextCaseState,
  parseAftercareChoice,
  type FrozenRefundLine,
} from "./model";
import {
  parseFeedbackCommand,
  completedPurchaseEligible,
  type FeedbackEligibility,
} from "../order-feedback/model";
const a = randomUUID(),
  b = randomUUID(),
  base = {
    actorKey: "a".repeat(64),
    orderId: randomUUID(),
    sellerId: randomUUID(),
    requestId: randomUUID(),
    expectedRevision: 0,
    language: "en",
  };
const lines: FrozenRefundLine[] = [
  {
    skuId: a,
    position: 0,
    quantity: 3,
    unitPriceMinor: 101,
    reservedQuantity: 0,
    originalPrefixMinor: 0,
  },
  {
    skuId: b,
    position: 1,
    quantity: 2,
    unitPriceMinor: 199,
    reservedQuantity: 0,
    originalPrefixMinor: 303,
  },
];
describe("original accepted refund units and integer fee conservation", () => {
  it("partial line units and remaining refund conserve exact original 701 gross and 37 fee without changing prices", () => {
    const original = structuredClone(lines),
      first = refundPortions(lines, [{ skuId: b, quantity: 1 }], 701, 37);
    expect(first[0]).toMatchObject({
      skuId: b,
      fromQuantity: 0,
      quantity: 1,
      amountMinor: 199,
      taxMinor: null,
      taxBasis: "inclusive_unspecified",
    });
    const rest = refundPortions(
      lines.map((line) => ({
        ...line,
        reservedQuantity: line.skuId === b ? 1 : 0,
      })),
      "remaining",
      701,
      37,
    );
    expect(
      [...first, ...rest].reduce((n, line) => n + line.amountMinor, 0),
    ).toBe(701);
    expect([...first, ...rest].reduce((n, line) => n + line.feeMinor, 0)).toBe(
      37,
    );
    expect(lines).toEqual(original);
  });
  it("refunds each original unit once and closes the rounding remainder exactly", () => {
    let reserved = 0,
      gross = 0,
      fees = 0;
    for (let index = 0; index < 3; index++) {
      const portions = refundPortions(
        lines.map((line) => ({
          ...line,
          reservedQuantity: line.skuId === a ? reserved : 0,
        })),
        [{ skuId: a, quantity: 1 }],
        701,
        37,
      );
      expect(portions[0].fromQuantity).toBe(index);
      reserved++;
      gross += portions[0].amountMinor;
      fees += portions[0].feeMinor;
    }
    const rest = refundPortions(
      lines.map((line) => ({
        ...line,
        reservedQuantity: line.skuId === a ? 3 : 0,
      })),
      "remaining",
      701,
      37,
    );
    expect(gross + rest.reduce((n, line) => n + line.amountMinor, 0)).toBe(701);
    expect(fees + rest.reduce((n, line) => n + line.feeMinor, 0)).toBe(37);
  });
  it("rejects overdrawn, duplicate or foreign SKU selections", () => {
    for (const selection of [
      [{ skuId: a, quantity: 4 }],
      [
        { skuId: a, quantity: 1 },
        { skuId: a, quantity: 1 },
      ],
      [{ skuId: randomUUID(), quantity: 1 }],
    ])
      expect(() => refundPortions(lines, selection, 701, 37)).toThrow();
  });
  it("rejects unsupported added shipping fees, tampered prefixes and exhausted balance", () => {
    expect(() => refundPortions(lines, "remaining", 801, 37)).toThrow();
    expect(() =>
      refundPortions(
        lines.map((line) => ({ ...line, originalPrefixMinor: 0 })),
        "remaining",
        701,
        37,
      ),
    ).toThrow();
    expect(() =>
      refundPortions(
        lines.map((line) => ({ ...line, reservedQuantity: line.quantity })),
        "remaining",
        701,
        37,
      ),
    ).toThrow();
  });
  it("rejects unsafe gross/fee bounds and fractional quantities", () => {
    expect(() =>
      refundPortions(lines, [{ skuId: a, quantity: 0.5 }], 701, 37),
    ).toThrow();
    expect(() => refundPortions(lines, "remaining", 701, 702)).toThrow();
    expect(() =>
      refundPortions(lines, "remaining", Number.MAX_SAFE_INTEGER, 37),
    ).toThrow();
  });
});
describe("separate authority and immutable case inputs", () => {
  it("rejects browser amount, role, policy approval and current auth projections", () => {
    for (const injected of [
      { amountMinor: 1 },
      { role: "owner" },
      { approved: true },
      { recentlyAuthenticated: true },
    ])
      expect(() =>
        parseAftercareCommand({
          ...base,
          action: "prepare_refund",
          caseId: null,
          reason: "Original refund",
          selection: "remaining",
          lines: [],
          ...injected,
        }),
      ).toThrow();
  });
  it("bounds private evidence and requires explicit immutable choice acknowledgment", () => {
    expect(() =>
      parseAftercareCommand({
        ...base,
        sellerId: null,
        action: "open",
        reason: "other",
        body: "Evidence",
        evidence: Array(5).fill("private"),
        servicePolicyId: randomUUID(),
        servicePolicyVersion: 1,
        serviceTermsHash: "b".repeat(64),
        acknowledged: true,
      }),
    ).toThrow();
    expect(() =>
      parseAftercareChoice({
        policyId: randomUUID(),
        version: 1,
        termsHash: "b".repeat(64),
        acknowledged: false,
      }),
    ).toThrow();
  });
  it("merchant proposal can be accepted only by the original buyer, appeal requires reviewed state", () => {
    expect(nextCaseState("open", "merchant", "propose")).toBe("awaiting_buyer");
    expect(nextCaseState("awaiting_buyer", "buyer", "accept")).toBe("resolved");
    expect(() =>
      nextCaseState("awaiting_buyer", "merchant", "accept"),
    ).toThrow();
    expect(() => nextCaseState("open", "buyer", "appeal")).toThrow();
    expect(nextCaseState("reviewed", "buyer", "appeal")).toBe(
      "review_requested",
    );
  });
});
const completed: FeedbackEligibility = {
    paymentState: "paid",
    settlementState: "transferred",
    fulfilmentState: "collected",
    shippingCompleted: false,
    aftercareRefundedMinor: 0,
    hasUnresolvedRefund: false,
    legacyRefundState: null,
    hasOpenCase: false,
    paymentEvidence: true,
  },
  policy = { allowRefundedFeedback: false, allowOpenCaseFeedback: false };
describe("feedback requires actual complete paid evidence", () => {
  it("rejects contact-only, redirects, pending settlement, disputed, refunded or unresolved orders", () => {
    expect(completedPurchaseEligible(completed, policy)).toBe(true);
    for (const patch of [
      { paymentEvidence: false },
      { paymentState: "reconciliation" },
      { paymentState: "disputed" },
      { settlementState: "reconciliation" },
      { fulfilmentState: "pending" },
      { aftercareRefundedMinor: 1 },
      { hasUnresolvedRefund: true },
      { legacyRefundState: "failed" },
      { hasOpenCase: true },
    ])
      expect(
        completedPurchaseEligible({ ...completed, ...patch }, policy),
      ).toBe(false);
  });
  it("rejects merchant feedback and foreign browser eligibility claims", () => {
    const command = {
      ...base,
      sellerId: null,
      rating: 5,
      body: "Original buyer review",
      policyId: randomUUID(),
      version: 1,
      termsHash: "c".repeat(64),
      acknowledged: true,
    };
    expect(parseFeedbackCommand(command).sellerId).toBeNull();
    expect(() =>
      parseFeedbackCommand({ ...command, sellerId: randomUUID() }),
    ).toThrow();
    expect(() =>
      parseFeedbackCommand({ ...command, eligible: true }),
    ).toThrow();
  });
});
