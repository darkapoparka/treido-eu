import { expect, it } from "vitest";
import { declarationRecoveryKey, parseDeclarationDraft } from "./recovery";
const sellerId = "10000000-0000-4000-8000-000000000001",
  declarationId = "10000000-0000-4000-8000-000000000002";
const attempt = {
  sellerId,
  declarationId,
  expectedDeclarationRevision: 1,
  expectedSetupRevision: 2,
  expectedRequirementVersion: 1,
  decision: "rejected",
  reason: "Correct the address",
  requestId: "10000000-0000-4000-8000-000000000003",
};
const draft = {
  reason: attempt.reason,
  decision: attempt.decision,
  attempt,
  rejected: false,
};
it("preserves an uncertain exact decision request and its observed revisions", () => {
  expect(
    parseDeclarationDraft(JSON.stringify(draft), sellerId, declarationId),
  ).toEqual({ invalid: false, draft });
});
it("cannot revive another business/declaration attempt or changed request facts", () => {
  expect(
    parseDeclarationDraft(JSON.stringify(draft), declarationId, declarationId)
      .invalid,
  ).toBe(true);
  expect(
    parseDeclarationDraft(JSON.stringify(draft), sellerId, sellerId).invalid,
  ).toBe(true);
  expect(
    parseDeclarationDraft(
      JSON.stringify({ ...draft, reason: "Another decision" }),
      sellerId,
      declarationId,
    ).invalid,
  ).toBe(true);
});
it("isolates stored private notes by human and declaration", () => {
  expect(declarationRecoveryKey("actor-a", declarationId)).not.toBe(
    declarationRecoveryKey("actor-b", declarationId),
  );
  expect(declarationRecoveryKey("actor-a", declarationId)).not.toBe(
    declarationRecoveryKey("actor-a", sellerId),
  );
});
it("rejects corrupted and unbounded saved decisions without treating them as success", () => {
  expect(parseDeclarationDraft("{", sellerId, declarationId).invalid).toBe(
    true,
  );
  expect(
    parseDeclarationDraft("x".repeat(8001), sellerId, declarationId).invalid,
  ).toBe(true);
  expect(
    parseDeclarationDraft(
      JSON.stringify({ ...draft, decision: "verified" }),
      sellerId,
      declarationId,
    ).invalid,
  ).toBe(true);
  expect(
    parseDeclarationDraft(
      JSON.stringify({ ...draft, decision: ["rejected"] }),
      sellerId,
      declarationId,
    ).invalid,
  ).toBe(true);
});
