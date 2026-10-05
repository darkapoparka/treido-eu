import { expect, it } from "vitest";
import { parseAssistantInputContinuation } from "./continuation";
it("allows only read-only photo/voice destinations and a unique BG/EN locale", () => {
  expect(parseAssistantInputContinuation("/minis/photo-match")).toBe(
    "/minis/photo-match?lang=bg",
  );
  expect(
    parseAssistantInputContinuation("/minis/find-for-me/voice?lang=en"),
  ).toBe("/minis/find-for-me/voice?lang=en");
  for (const value of [
    "https://evil.test/minis/photo-match",
    "//evil.test/minis/photo-match",
    "/minis/photo-match?runId=owned",
    "/minis/photo-match?lang=en&lang=bg",
    "/minis/photo-match?lang=de",
    "/minis/photo-match#execute",
    "/minis/find-for-me/voice/..",
    "/minis\\photo-match",
    "/minis/photo-match?confirmed=true",
  ])
    expect(parseAssistantInputContinuation(value)).toBeNull();
});
