import { describe, expect, it } from "vitest";
import {
  canReadConnectStatus,
  connectRequirementGroups,
  connectStatusState,
  type ConnectStatus,
  type ConnectStatusState,
} from "./connect-status";
const base: ConnectStatus = {
  detailsSubmitted: true,
  payoutsEnabled: true,
  chargesEnabled: false,
  cardPayments: "unrequested",
  transfers: "active",
  currentlyDue: [],
  pastDue: [],
  pendingVerification: [],
  eventuallyDue: [],
  disabledReason: null,
  checkedAt: "2026-10-10T00:00:00.000Z",
  requirementsDeadline: null,
  supportedAccount: true,
  platformAccountReady: true,
  sellerAccountReady: false,
};
const cases: Array<[Partial<ConnectStatus>, ConnectStatusState]> = [
  [{ supportedAccount: false }, "unsupported"],
  [
    { currentlyDue: ["business_profile.url"], platformAccountReady: false },
    "action_required",
  ],
  [
    {
      pastDue: ["individual.verification.document"],
      platformAccountReady: false,
    },
    "action_required",
  ],
  [{ detailsSubmitted: false, platformAccountReady: false }, "action_required"],
  [
    {
      pendingVerification: ["individual.verification.document"],
      platformAccountReady: false,
    },
    "under_review",
  ],
  [
    { disabledReason: "rejected.fraud", platformAccountReady: false },
    "restricted",
  ],
  [{ platformAccountReady: false }, "pending"],
];
describe("merchant Connect status is separate from checkout approval", () => {
  it("allows billing review and delegated setup, not a generic catalog member", () => {
    expect(canReadConnectStatus(["seller.read", "listing.read"])).toBe(false);
    expect(canReadConnectStatus(["seller.read", "billing.manage"])).toBe(true);
    expect(canReadConnectStatus(["seller.read", "payment.setup"])).toBe(true);
    expect(canReadConnectStatus([])).toBe(false);
  });
  it("does not falsely require recipient card payments for platform settlement", () => {
    expect(connectStatusState(base)).toBe("capabilities_ready");
    expect(base.sellerAccountReady).toBe(false);
    expect(base).not.toHaveProperty("ready");
    expect(base).not.toHaveProperty("policyQualified");
  });
  it.each(cases)("projects current requirements %j", (change, state) => {
    expect(connectStatusState({ ...base, ...change })).toBe(state);
  });
  it("deduplicates requirements by urgency without changing provider input", () => {
    const input = {
      ...base,
      pastDue: ["a", "a"],
      currentlyDue: ["a", "b", "b"],
      pendingVerification: ["b", "c", "c"],
      eventuallyDue: ["a", "c", "d", "d"],
    };
    expect(connectRequirementGroups(input)).toEqual({
      pastDue: ["a"],
      current: ["b"],
      verification: ["c"],
      later: ["d"],
    });
    expect(input.pastDue).toEqual(["a", "a"]);
  });
});
