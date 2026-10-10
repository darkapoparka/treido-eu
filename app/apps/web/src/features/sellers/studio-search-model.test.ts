import { describe, expect, it } from "vitest";
import {
  matchesStudioText,
  parseStudioSearch,
  studioSearchGroups,
} from "./studio-search-model";
const command = {
  sellerId: "00000000-0000-4000-8000-000000000001",
  actorSubject: "user_synthetic",
  q: "  Лампа  ",
  group: "all",
  language: "bg",
};
describe("scoped Studio search", () => {
  it("normalizes only search whitespace and keeps current seller and actor binding", () => {
    expect(parseStudioSearch(command)).toEqual({ ...command, q: "Лампа" });
  });
  it.each([
    null,
    [],
    { ...command, sellerId: "other" },
    { ...command, actorSubject: "" },
    { ...command, group: "all_sellers" },
    { ...command, q: "x".repeat(161) },
    { ...command, providerId: "acct_foreign" },
    { ...command, language: "de" },
  ])("rejects malformed or expanded scope %j", (raw) => {
    expect(parseStudioSearch(raw)).toBeNull();
  });
  it("does not infer customer or financial visibility from listing or billing permission", () => {
    expect(studioSearchGroups(["seller.read", "billing.manage"])).toEqual([
      "all",
      "navigation",
    ]);
    expect(studioSearchGroups(["seller.read", "listing.read"])).toEqual([
      "all",
      "products",
      "navigation",
    ]);
    expect(studioSearchGroups(["seller.read", "order.read"])).toEqual([
      "all",
      "orders",
      "customers",
      "navigation",
    ]);
  });
  it("matches BG/EN case without treating regex or SQL wildcard text as operators", () => {
    expect(matchesStudioText("Настолна ЛАМПА", "лампа")).toBe(true);
    expect(matchesStudioText("Customers", "customer")).toBe(true);
    expect(matchesStudioText("anything", ".*")).toBe(false);
    expect(matchesStudioText("anything", "%")).toBe(false);
  });
});
