import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { boundedReason, parseModerationInput } from "./moderation-model";
const valid = () => ({
  listingId: randomUUID(),
  reportId: null,
  requestId: randomUUID(),
  expectedRevision: 1,
  state: "restricted",
  reason: "Reported unsafe item",
});
it("requires a reason, revision and finite decision independent of browser seller roles", () => {
  expect(parseModerationInput(valid())?.state).toBe("restricted");
  for (const value of [
    { ...valid(), reason: " " },
    { ...valid(), expectedRevision: 0 },
    { ...valid(), expectedRevision: 1.1 },
    { ...valid(), state: "approved" },
    { ...valid(), role: "owner" },
    { ...valid(), sellerId: randomUUID() },
  ])
    expect(parseModerationInput(value)).toBeNull();
  expect(boundedReason("x".repeat(2001))).toBeNull();
});
