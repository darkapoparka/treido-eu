import { describe, expect, it } from "vitest";
import { merchantNavigation } from "./merchant-navigation";
const sellerId = "10000000-0000-4000-8000-000000000001";
describe("real merchant permission-sensitive navigation", () => {
  it("does not expose financial, customer or team paths to catalogue staff", () => {
    const items = merchantNavigation({ sellerId, kind: "business", capabilities: ["listing.read"] }, "bg");
    expect(items.map((item) => item.key)).toEqual(["home", "products", "inventory", "moderation", "invitations"]);
  });
  it("lets a personal seller edit their profile and drafts without business setup", () => {
    const items = merchantNavigation({ sellerId, kind: "personal", capabilities: ["listing.read", "listing.write", "profile.manage", "order.read"] }, "en");
    expect(items.map((item) => item.key)).toContain("helper");
    expect(items.map((item) => item.key)).toContain("customers");
    expect(items.map((item) => item.key)).not.toContain("team");
    expect(items.every((item) => !item.href.includes("onboarding"))).toBe(true);
  });
  it("keeps financial access separate from billing administration", () => {
    const items = merchantNavigation({ sellerId, kind: "business", capabilities: ["order.read"] }, "en");
    expect(items.map((item) => item.key)).toEqual(["home", "orders", "customers", "invitations"]);
  });
  it.each(["bg", "en"] as const)("preserves %s and explicit seller scope", (language) => {
    for (const item of merchantNavigation({ sellerId, kind: "business", capabilities: ["listing.read", "listing.write", "order.read", "billing.manage", "inbox.read", "import.run", "team.manage", "analytics.read", "marketing.manage"] }, language)) {
      expect(item.href).toContain(`lang=${language}`);
      if (item.key !== "invitations") expect(item.href).toContain(`/app/sellers/${sellerId}`);
    }
  });
});
