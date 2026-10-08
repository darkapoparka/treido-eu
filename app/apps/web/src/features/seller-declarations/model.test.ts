import { describe, expect, it } from "vitest";
import {
  parseDeclarationQueueQuery,
  parseReviewDeclarationInput,
} from "./model";

const input = {
  sellerId: "10000000-0000-4000-8000-000000000001",
  declarationId: "10000000-0000-4000-8000-000000000002",
  expectedDeclarationRevision: 1,
  expectedSetupRevision: 2,
  expectedRequirementVersion: 1,
  decision: "accepted",
  reason: "Reviewed submitted trader details",
  requestId: "10000000-0000-4000-8000-000000000003",
};
describe("operator declaration input boundary", () => {
  it("retains every observed revision and deliberate decision in canonical input", () => {
    expect(
      parseReviewDeclarationInput({
        ...input,
        reason: "  Needs corrected address  ",
        decision: "rejected",
      }),
    ).toEqual({
      ...input,
      reason: "Needs corrected address",
      decision: "rejected",
    });
  });
  it.each([
    { sellerId: "../another" },
    { declarationId: "" },
    { requestId: "not-a-request" },
    { expectedDeclarationRevision: 0 },
    { expectedDeclarationRevision: 3 },
    { expectedSetupRevision: 1.5 },
    { expectedSetupRevision: 2147483646 },
    { expectedRequirementVersion: 2 },
    { decision: "verified" },
    { decision: "review_required" },
    { decision: ["accepted"] },
    { reason: "x" },
    { reason: "x".repeat(2001) },
    { reason: "Private\u0000record" },
    { actorId: input.sellerId },
    { role: "operator" },
    { country: "FR" },
  ])("rejects forged, unsupported or unbounded review facts: %j", (change) => {
    expect(parseReviewDeclarationInput({ ...input, ...change })).toBeNull();
  });
  it("does not accept a missing observed setup revision", () => {
    const { expectedSetupRevision: omitted, ...missing } = input;
    expect(omitted).toBe(2);
    expect(parseReviewDeclarationInput(missing)).toBeNull();
  });
});
describe("bounded operator declaration queue", () => {
  it("defaults to real outstanding submissions and normalizes literal search", () => {
    expect(parseDeclarationQueueQuery({})).toEqual({
      state: "review_required",
      q: "",
      before: null,
    });
    expect(
      parseDeclarationQueueQuery({ state: "all", q: "  Test business  " }),
    ).toEqual({ state: "all", q: "Test business", before: null });
  });
  it.each([
    { state: "paid" },
    { state: ["all"] },
    { q: "x".repeat(81) },
    { q: "a\nb" },
    { before: "forged" },
    { sellerId: input.sellerId },
  ])("rejects unsupported queue criteria: %j", (query) => {
    expect(parseDeclarationQueueQuery(query)).toBeNull();
  });
});
