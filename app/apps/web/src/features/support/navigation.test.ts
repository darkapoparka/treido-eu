import { expect, it } from "vitest";
import { parseSupportContinuation } from "./navigation";
const id = "12345678-1234-4234-8234-123456789012";
it("preserves only scoped support navigation", () => {
  expect(parseSupportContinuation("/support/requests?lang=bg")).toBe("/support/requests?lang=bg");
  expect(parseSupportContinuation("/ops/support/"+id+"?lang=en&beforeSequence=4")).toBe("/ops/support/"+id+"?beforeSequence=4&lang=en");
  for (const input of ["https://evil.invalid", "//evil.invalid", "/support/requests?next=//evil.invalid", "/ops/support/invalid", "/support/requests?lang=bg&lang=en", "/support/requests/%2e%2e", "/ops/support/"+id+"?beforeSequence=-1", "/support/requests?lang=en#fragment"]) expect(parseSupportContinuation(input)).toBeNull();
});
