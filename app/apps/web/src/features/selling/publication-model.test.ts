import { expect, it } from "vitest";
import { emptyDraft } from "./draft-model";
import {
  parseWithdrawalInput,
  publicationFieldIssues,
} from "./publication-model";
it("publication review distinguishes incomplete saved data from valid publication", () => {
  expect(publicationFieldIssues(emptyDraft)).toEqual([
    "title",
    "description",
    "price",
    "locality",
    "category",
  ]);
  expect(
    publicationFieldIssues({
      ...emptyDraft,
      categoryId: "cat:electronics/phones",
      condition: "good",
    }),
  ).toContain("attribute:brand");
});
it("withdrawal does not accept client authority, scope or quota", () => {
  const input = {
    sellerId: "b3db8275-e48a-4f4c-8a9e-b2805ab04631",
    listingId: "cf081b46-5730-4978-b8eb-d50825a7b508",
    requestId: "145c4df5-991c-49e5-8c6c-3c2d77296377",
    expectedRevision: 1,
  };
  expect(parseWithdrawalInput(input)).toEqual(input);
  for (const key of ["seller", "role", "quota", "publication"])
    expect(parseWithdrawalInput({ ...input, [key]: "allowed" })).toBeNull();
  expect(parseWithdrawalInput({ ...input, expectedRevision: 0 })).toBeNull();
});
