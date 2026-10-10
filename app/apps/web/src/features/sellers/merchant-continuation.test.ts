import { describe, expect, it } from "vitest";
import { parseMerchantContinuation } from "./merchant-continuation";
import { parseWorkspaceAccessRoute } from "./workspace-access";
const seller = "10000000-0000-4000-8000-000000000001";
const order = "10000000-0000-4000-8000-000000000002";
describe("merchant continuation and restored frame scope", () => {
  it("retains Bulgarian order filters without accepting arbitrary destinations", () => {
    const path = `/app/sellers/${seller}/orders?lang=bg&q=${encodeURIComponent("Дълго име")}&queue=financial&customerOrder=${order}`;
    expect(parseMerchantContinuation(path)).toBe(`/app/sellers/${seller}/orders?lang=bg&q=${encodeURIComponent("Дълго име").replaceAll("%20", "+")}&queue=financial&customerOrder=${order}`);
    expect(parseWorkspaceAccessRoute(path).query.customerOrder).toBe(order);
  });
  it("rechecks customer and helper paths as seller pages", () => {
    expect(parseWorkspaceAccessRoute(`/app/sellers/${seller}/customers?before=${order}`).page).toBe("customers");
    expect(parseWorkspaceAccessRoute(`/app/sellers/${seller}/sell-helper?draftId=${order}`).query.draftId).toBe(order);
  });
  it.each([
    `https://evil.invalid/app/sellers/${seller}/orders`,
    `//evil.invalid/app/sellers/${seller}/orders`,
    `/app/sellers/${seller}/customers?before=${order}&before=${seller}`,
    `/app/sellers/${seller}/sell-helper?price=1`,
    `/app/sellers/${seller}/orders?actor=override`,
    `/app/sellers/${seller}/orders?queue=paid%0a`,
    `/app/sellers/${seller}/customers/../orders`,
  ])("rejects unsafe or ambiguous merchant continuation %s", (path) => {
    expect(parseMerchantContinuation(path)).toBeNull();
  });
});
