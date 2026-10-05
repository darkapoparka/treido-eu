import { describe, expect, it } from "vitest";
import {
  assertNoObligations,
  canCancel,
  categories,
  ClosureError,
  obligationNames,
  parseCommand,
  type ClosureCommand,
  type Obligations,
  type ClosurePolicy,
} from "./model";
import { parsePolicy, removalDelay } from "./policy";
const request = "9d365d46-fd3f-49d4-919c-eaeb92367e66",
  actor = "a".repeat(64);
const command = (operation: ClosureCommand["operation"]) => ({
  version: 1,
  actorKey: actor,
  requestId: request,
  expectedRevision: 0,
  operation,
});
const policy = (): ClosurePolicy => ({
  version: "isolated-test-v1",
  approvalReference: "isolated parser fixture only; no real approval",
  summary: { bg: "Тест", en: "Test" },
  rules: categories.map((category) => ({
    category,
    handling: "retain",
    purpose: { bg: "Тестова цел", en: "Test purpose" },
    trigger: "obligationsResolved",
    delaySeconds: null,
    explanation: { bg: "Само тест", en: "Test only" },
  })),
  identity: "revoke",
  personalBilling: "stop-renewal",
  preservesAcceptedEvidence: true,
  reversibleBeforeEffects: true,
});
describe("explicit lifecycle inputs and reviewed-policy boundaries", () => {
  it("requires literal confirmation and the exact immutable plan hash", () => {
    const value = command({
      kind: "confirm",
      planId: request,
      planHash: actor,
      acknowledged: true,
    });
    expect(parseCommand(value)).toEqual(value);
    for (const changed of [
      { ...value, operation: { ...value.operation, acknowledged: "true" } },
      {
        ...value,
        operation: {
          kind: "confirm",
          planId: request,
          planHash: "x",
          acknowledged: true,
        },
      },
      { ...value, operation: { ...value.operation, providerPaid: true } },
    ])
      expect(() => parseCommand(changed)).toThrow(ClosureError);
  });
  it("accepts deliberate preference saves without granting consent, entitlement or an operating seller", () => {
    for (const locale of ["bg", "en"] as const)
      for (const browseScope of ["all", "personal", "business"] as const)
        expect(
          parseCommand(command({ kind: "preferences", locale, browseScope }))
            .operation,
        ).toEqual({ kind: "preferences", locale, browseScope });
    for (const property of [
      "sellerId",
      "subscription",
      "notifications",
      "marketingConsent",
    ])
      expect(() =>
        parseCommand({
          ...command({
            kind: "preferences",
            locale: "bg",
            browseScope: "business",
          }),
          operation: {
            kind: "preferences",
            locale: "bg",
            browseScope: "business",
            [property]: true,
          },
        }),
      ).toThrow(ClosureError);
  });
  it("rejects foreign/raw session identifiers and extra command fields", () => {
    expect(() =>
      parseCommand(
        command({
          kind: "revokeSession",
          sessionRef: "sess_foreign",
          acknowledged: true,
        }),
      ),
    ).toThrow(ClosureError);
    expect(() =>
      parseCommand({
        ...command({ kind: "cancel", planId: request }),
        subject: "user_foreign",
      }),
    ).toThrow(ClosureError);
    expect(() =>
      parseCommand({
        ...command({ kind: "cancel", planId: request }),
        expectedRevision: -1,
      }),
    ).toThrow(ClosureError);
  });
  it("does not invent retention when a removal rule has no reviewed deadline", () => {
    const value = policy();
    value.rules[0].handling = "remove";
    expect(() => parsePolicy(value)).toThrow(ClosureError);
    const retained = parsePolicy(policy());
    expect(removalDelay(retained, "personalMedia")).toBeNull();
  });
  it.each(["commerceEvidence", "businessEvidence", "caseEvidence"])(
    "never accepts deletion of %s through closure",
    (category) => {
      const value = policy(),
        rule = value.rules.find((rule) => rule.category === category)!;
      rule.handling = "remove";
      rule.trigger = "closure";
      rule.delaySeconds = 0;
      expect(() => parsePolicy(value)).toThrow(ClosureError);
    },
  );
  it("requires complete unique category handling and multilingual purposes", () => {
    const missing = policy();
    missing.rules.pop();
    expect(() => parsePolicy(missing)).toThrow(ClosureError);
    const duplicate = policy();
    duplicate.rules[0] = duplicate.rules[1];
    expect(() => parsePolicy(duplicate)).toThrow(ClosureError);
    const blank = policy();
    blank.summary.bg = "";
    expect(() => parsePolicy(blank)).toThrow(ClosureError);
  });
  it("holds each distinct real obligation and rejects unavailable counters", () => {
    const clear = Object.fromEntries(
      obligationNames.map((name) => [name, 0]),
    ) as Obligations;
    expect(() => assertNoObligations(clear)).not.toThrow();
    for (const name of obligationNames) {
      expect(() => assertNoObligations({ ...clear, [name]: 1 })).toThrowError(
        "OBLIGATIONS_HELD",
      );
      expect(() =>
        assertNoObligations({ ...clear, [name]: null }),
      ).toThrowError("NOT_AVAILABLE");
    }
  });
  it("never permits cancellation after an external attempt, including an unknown result", () => {
    expect(canCancel("reviewed", false)).toBe(true);
    expect(canCancel("accepted", false)).toBe(true);
    for (const state of [
      "accepted",
      "processing",
      "blocked",
      "reconciling",
      "completed",
      "cancelled",
    ] as const)
      expect(canCancel(state, true)).toBe(false);
  });
});
