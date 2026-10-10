import { describe, expect, it } from "vitest";
import { operationCount, operationDestination, permittedOperations } from "./operations-model";

describe("current seller operational projection", () => {
  it("never treats account selection as dataset permission", () => {
    expect(permittedOperations({ kind: "business", capabilities: ["seller.read"] })).toEqual([]);
  });
  it("keeps personal operations independent of business setup", () => {
    expect(permittedOperations({ kind: "personal", capabilities: ["listing.read", "order.read", "import.run"] })).toEqual(["drafts", "withdrawn", "restricted", "published", "photos", "stock", "orders", "fulfilment", "payments"]);
  });
  it("does not expose order or finance counts to listing-only staff", () => {
    expect(permittedOperations({ kind: "business", capabilities: ["listing.read", "inbox.read"] })).toEqual(["drafts", "withdrawn", "restricted", "published", "photos", "stock", "offers"]);
  });
  it("requires both import and listing read for a business import count", () => {
    expect(permittedOperations({ kind: "business", capabilities: ["import.run"] })).toEqual([]);
    expect(permittedOperations({ kind: "business", capabilities: ["listing.read", "import.run"] })).toContain("imports");
  });
  it("opens the exact unfinished-work queue rather than hiding counted products", () => {
    expect(operationDestination("seller-a", "drafts")).toBe("/app/sellers/seller-a/listings?status=draft");
    expect(operationDestination("seller-a", "withdrawn")).toBe("/app/sellers/seller-a/listings?status=withdrawn");
    expect(operationDestination("seller-a", "restricted")).toBe("/app/sellers/seller-a/listings?status=restricted");
    expect(operationDestination("seller-a", "fulfilment")).toBe("/app/sellers/seller-a/orders?queue=fulfilment");
    expect(operationDestination("seller-a", "payments")).toBe("/app/sellers/seller-a/orders?queue=financial");
  });
  it("distinguishes an exact zero from a bounded lower count", () => {
    expect(operationCount("drafts", 0)).toEqual({ kind: "drafts", count: 0, hasMore: false });
    expect(operationCount("drafts", 1000)).toEqual({ kind: "drafts", count: 1000, hasMore: false });
    expect(operationCount("drafts", 1001)).toEqual({ kind: "drafts", count: 1000, hasMore: true });
  });
  it.each([-1, 1.5, NaN, Infinity, 1002])("rejects invalid source counts %s", (count) => {
    expect(() => operationCount("orders", count)).toThrow();
  });
  it("retains the explicit operating seller in each destination", () => {
    for (const kind of permittedOperations({ kind: "business", capabilities: ["listing.read", "inbox.read", "order.read", "import.run"] }))
      expect(operationDestination("seller-a", kind)).toMatch(/^\/app\/sellers\/seller-a\//);
  });
});
