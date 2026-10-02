import { describe, expect, it } from "vitest";
import {
  BUSINESS_SETUP_VERSION,
  declarationComplete,
  declarationSubmissionIssue,
  declarationReadiness,
  emptyDeclaration,
  parseBusinessProfile,
  parseTraderDeclaration,
  parseSignupIntent,
  validRevision,
} from "./setup-model";
import { parseWorkspaceContinuation } from "./workspace-continuation";
import { randomUUID } from "node:crypto";

describe("business setup validation and current requirements", () => {
  it("allows incomplete drafts and normalizes bounded public details", () => {
    expect(
      parseBusinessProfile({
        name: "  Магазин  ",
        description: "  ",
        locality: " София ",
      }),
    ).toEqual({ name: "Магазин", description: "", locality: "София" });
    expect(parseTraderDeclaration(emptyDeclaration)).toEqual(emptyDeclaration);
    expect(declarationComplete(emptyDeclaration)).toBe(false);
  });
  it.each([
    null,
    [],
    { name: "x", description: "", locality: "" },
    { name: "Store", description: "a".repeat(1201), locality: "" },
    { name: "Store", description: "", locality: "\u0000" },
    { name: "Store", description: "", locality: "", grants: ["team.manage"] },
  ])(
    "rejects malformed, oversized and authority-bearing profiles: %j",
    (input) => {
      expect(parseBusinessProfile(input)).toBeNull();
    },
  );
  it.each([
    { ...emptyDeclaration, country: "GB" },
    { ...emptyDeclaration, contactEmail: "not-an-email" },
    { ...emptyDeclaration, legalName: "x".repeat(161) },
    { ...emptyDeclaration, accurate: "true" },
    { ...emptyDeclaration, status: "accepted" },
    { ...emptyDeclaration, requirementVersion: 999 },
  ])("rejects forged declarations: %j", (input) => {
    expect(parseTraderDeclaration(input)).toBeNull();
  });
  it("requires trader identity, contact and an explicit declaration for submission", () => {
    const complete = {
      ...emptyDeclaration,
      legalName: "Example Ltd",
      registrationNumber: "123456789",
      contactEmail: "seller@example.test",
      contactAddress: "1 Example Street",
      accurate: true,
    };
    expect(declarationComplete(complete)).toBe(true);
    for (const field of [
      "legalName",
      "registrationNumber",
      "contactEmail",
      "contactAddress",
    ] as const) {
      expect(declarationComplete({ ...complete, [field]: "" })).toBe(false);
      expect(declarationComplete({ ...complete, [field]: "   " })).toBe(false);
      expect(declarationSubmissionIssue({ ...complete, [field]: "   " })).toBe(
        field,
      );
    }
    for (const field of [
      "legalName",
      "registrationNumber",
      "contactAddress",
    ] as const)
      expect(declarationSubmissionIssue({ ...complete, [field]: "X" })).toBe(
        field,
      );
    expect(
      declarationSubmissionIssue({ ...complete, contactEmail: "a@b" }),
    ).toBe("contactEmail");
    expect(declarationComplete({ ...complete, accurate: false })).toBe(false);
  });
  it("reopens an accepted declaration when required version or country changes", () => {
    const accepted = {
      status: "accepted" as const,
      country: "BG",
      requirementVersion: BUSINESS_SETUP_VERSION,
    };
    expect(declarationReadiness(accepted)).toBe("current");
    expect(declarationReadiness(accepted, BUSINESS_SETUP_VERSION + 1)).toBe(
      "stale",
    );
    expect(declarationReadiness({ ...accepted, country: "RO" })).toBe("stale");
    expect(
      declarationReadiness({ ...accepted, status: "review_required" }),
    ).toBe("review_required");
    expect(declarationReadiness({ ...accepted, status: "rejected" })).toBe(
      "rejected",
    );
    expect(declarationReadiness(null)).toBe("required");
  });
  it("signup intent is optional and contains no seller authority", () => {
    for (const intent of [null, "buy", "personal", "business"])
      expect(parseSignupIntent(intent)).toBe(intent);
    for (const intent of ["owner", undefined, { sellerId: randomUUID() }, true])
      expect(parseSignupIntent(intent)).toBeUndefined();
  });
  it.each([-1, 1.5, NaN, Infinity, "1", 2147483647])(
    "rejects invalid setup revisions: %j",
    (revision) => {
      expect(validRevision(revision)).toBe(false);
    },
  );
});
describe("safe workspace sign-in recovery", () => {
  const id = "12345678-1234-4123-8123-123456789012";
  it.each([
    "/app",
    "/app?lang=bg",
    "/app/intent?lang=en",
    "/app/onboarding?lang=bg",
    `/app/sellers/${id}`,
    `/app/sellers/${id}/settings?lang=en`,
    `/app/sellers/${id}/onboarding?lang=bg&step=declaration`,
  ])("accepts a known internal route: %s", (route) => {
    expect(parseWorkspaceContinuation(route)).not.toBeNull();
  });
  it.each([
    "https://example.test/app",
    "//example.test/app",
    "/app/../private",
    "/app%2fintent",
    "/app?lang=en&lang=bg",
    "/app?role=owner",
    "/app/intent?returnTo=https://example.test",
    `/app/sellers/${id}/onboarding?step=payments`,
    `/app/sellers/${id}/billing`,
    "/app/sellers/arbitrary-id/settings",
    "/app#private",
    "/app\\intent",
    "/app?lang=bg&seller=business",
  ])("rejects unsafe/unrelated continuations: %s", (route) => {
    expect(parseWorkspaceContinuation(route)).toBeNull();
  });
  it("canonicalizes step and language without gaining authority", () => {
    expect(
      parseWorkspaceContinuation(
        `/app/sellers/${id}/onboarding?lang=bg&step=declaration`,
      ),
    ).toBe(`/app/sellers/${id}/onboarding?step=declaration&lang=bg`);
  });
});
