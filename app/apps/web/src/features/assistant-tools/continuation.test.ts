import { describe, expect, it } from "vitest";
import { parseAssistantContinuation } from "./continuation";
const id = "10000000-0000-4000-8000-000000000001";
describe("read-only assistant continuation", () => {
  it.each([
    "/minis/compatibility",
    "/minis/sell-helper",
    "/minis/compatibility?lang=bg",
    "/minis/sell-helper?lang=en",
    `/minis/compatibility?listing=${id}`,
    `/minis/sell-helper?sellerId=${id}&draftId=${id}`,
  ])("accepts %s", (path) => {
    expect(parseAssistantContinuation(path)).toBe(path);
  });
  it.each([
    "https://other.invalid/minis/compatibility",
    "//other.invalid/minis/compatibility",
    "/minis/compatibility/extra",
    "/minis/sell-helper#accept",
    "/minis/compatibility?lang=de",
    "/minis/compatibility?lang=bg&lang=en",
    "/minis/compatibility?publish=true",
    `/minis/sell-helper?draftId=${id}`,
    `/minis/sell-helper?sellerId=${id}&sellerId=${id}`,
    `/minis/compatibility?listing=${id}&listing=${id}`,
    "/minis/compatibility?listing=foreign",
    `/minis/compatibility?categoryId=cat:electronics`,
    "/minis/sell-helper?confirm=true",
    "/minis/compatibility\\other",
    "/minis/compatibility?" + "x".repeat(1100),
  ])("rejects unsafe/ambiguous %s", (path) => {
    expect(parseAssistantContinuation(path)).toBeNull();
  });
  it("canonicalises UUID casing", () => {
    const upper = "A0000000-0000-4000-8000-000000000001";
    expect(
      parseAssistantContinuation("/minis/compatibility?listing=" + upper),
    ).toBe("/minis/compatibility?listing=" + upper.toLowerCase());
  });
  it("accepts a real leaf without storing requirements or accepting a proposal", () => {
    expect(
      parseAssistantContinuation(
        "/minis/compatibility?categoryId=cat%3Aelectronics%2Fphones",
      ),
    ).toBe("/minis/compatibility?categoryId=cat%3Aelectronics%2Fphones");
  });
});
