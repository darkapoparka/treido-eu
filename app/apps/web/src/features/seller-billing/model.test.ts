import { describe, expect, it } from "vitest";
import {
  entitlementActive,
  parseBillingCommand,
  PLANS,
  safeBillingUrl,
} from "./model";

const command = {
  sellerId: "7f73a674-b70b-424b-973a-85999aec0935",
  requestId: "f31dc36b-6a56-44fb-8a32-3c0d7a6d79ea",
  actorKey: "a".repeat(64),
  operation: "checkout",
  planId: "business_pro",
  version: 1,
  previewId: null,
  language: "bg",
};
describe("seller billing boundary", () => {
  it("accepts deliberate finite commands and rejects arbitrary provider inputs", () => {
    expect(parseBillingCommand(command)?.operation).toBe("checkout");
    for (const attack of [
      { ...command, price: "price_arbitrary" },
      { ...command, version: 0 },
      { ...command, planId: "business_free" },
      { ...command, amountMinor: 1 },
      { ...command, actorKey: "" },
      { ...command, language: "fr" },
      { ...command, previewId: command.requestId },
    ])
      expect(parseBillingCommand(attack)).toBeNull();
    expect(
      parseBillingCommand({
        ...command,
        operation: "change",
        previewId: command.requestId,
      }),
    ).not.toBeNull();
    expect(parseBillingCommand({ ...command, operation: "change" })).toBeNull();
  });
  it("uses inclusive start and exclusive original deadline without browser success authority", () => {
    expect(entitlementActive(10, 10, 20, false)).toBe(true);
    expect(entitlementActive(20, 10, 20, false)).toBe(false);
    expect(entitlementActive(11, 10, 20, true)).toBe(false);
    expect(entitlementActive(9, 10, 20, false)).toBe(false);
    expect(entitlementActive(11, 20, 10, false)).toBe(false);
  });
  it("keeps invoice, checkout and portal hosts distinct and rejects credential/URL tricks", () => {
    expect(
      safeBillingUrl(
        "https://invoice.stripe.com/i/acct_example/test",
        "invoice",
      ),
    ).toBeTruthy();
    for (const url of [
      "http://invoice.stripe.com/i/test",
      "https://invoice.stripe.com.evil.example/i/test",
      "https://evil@invoice.stripe.com/i/test",
      "https://invoice.stripe.com:4430/i/test",
      "https://checkout.stripe.com/i/test",
      "https://invoice.stripe.com\\@evil.example/i/test",
      "javascript:alert(1)",
      "https://invoice.stripe.com/\nsecret",
    ])
      expect(safeBillingUrl(url, "invoice")).toBeNull();
  });
  it("preserves base publishing and finite approved v1 upgrade limits", () => {
    expect(PLANS.personal_free.limits.active).toBe(30);
    expect(PLANS.business_free.limits.importRows).toBe(25);
    expect(PLANS.business_pro.limits.seats).toBe(10);
    expect(PLANS.personal_pro.limits.variants).toBe(1);
    expect(PLANS.business_free.limits.commercialExport).toBe(false);
  });
});
