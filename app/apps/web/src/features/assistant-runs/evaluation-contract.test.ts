import { expect, it } from "vitest";
import {
  assistantEvaluationCases,
  assistantEvaluationStatus,
} from "./evaluation-contract";
import { criteria } from "./model";
it("versioned contract contains six required groups of ten with equal BG/EN coverage", () => {
  expect(assistantEvaluationCases).toHaveLength(60);
  expect(new Set(assistantEvaluationCases.map((row) => row.id)).size).toBe(60);
  for (const group of new Set(
    assistantEvaluationCases.map((row) => row.group),
  )) {
    const cases = assistantEvaluationCases.filter((row) => row.group === group);
    expect(cases).toHaveLength(10);
    expect(cases.filter((row) => row.locale === "bg")).toHaveLength(5);
  }
  for (const row of assistantEvaluationCases)
    expect(() => criteria(row.criteria)).not.toThrow();
});
it("source preparation never presents synthetic cases as a measured provider quality/cost/latency pass", () => {
  expect(assistantEvaluationStatus).toMatchObject({
    executed: false,
    providerQualified: false,
    quality: null,
    latency: null,
    cost: null,
    modelVersion: null,
  });
  expect(
    assistantEvaluationCases
      .filter((row) => ["photo", "voice"].includes(row.subject))
      .every((row) => row.inputFixture !== null),
  ).toBe(true);
});
