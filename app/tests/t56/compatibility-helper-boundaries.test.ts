import { describe, expect, it } from "vitest";
import {
  compatibilityEvidence,
  parseCompatibilityCommand,
  parseRequirements,
  type CompatibilitySnapshot,
} from "../../apps/web/src/features/assistant-tools/compatibility-model";
import {
  parseHelperCommand,
  parseHelperEdit,
} from "../../apps/web/src/features/assistant-tools/sell-helper-model";

const id = "00000000-0000-4000-8000-000000000001";
const envelope = {
  actorKey: "a".repeat(64),
  requestId: id,
  expectedRevision: 0,
};
const categoryId = "cat:electronics/phones";
const requirements = parseRequirements({
  categoryId,
  fields: [{ field: "storageGB", operator: "at_least", value: 128 }],
});
const snapshot: CompatibilitySnapshot = {
  categoryId,
  attributes: { storageGB: 128 },
  observation: {
    listingId: id,
    publicationRevision: 2,
    skuId: null,
    priceMinor: 0,
    stock: "unknown",
  },
};
describe("T56 factual Compatibility and explicit Sell Helper boundaries", () => {
  it.each([
    [128, "agreement"],
    [256, "agreement"],
    [64, "disagreement"],
  ] as const)(
    "reports declared storage %i as %s without a fit verdict",
    (storageGB, outcome) => {
      expect(
        compatibilityEvidence(requirements, {
          ...snapshot,
          attributes: { storageGB },
        })[0].outcome,
      ).toBe(outcome);
    },
  );
  it("keeps missing and incomparable facts distinct", () => {
    expect(
      compatibilityEvidence(requirements, { ...snapshot, attributes: {} })[0]
        .outcome,
    ).toBe("missing");
    expect(
      compatibilityEvidence(requirements, {
        ...snapshot,
        categoryId: "cat:home/storage-shelving",
      })[0].outcome,
    ).toBe("incomparable");
    expect(
      compatibilityEvidence(requirements, {
        ...snapshot,
        attributes: { storageGB: -1 },
      })[0].outcome,
    ).toBe("incomparable");
  });
  it.each([
    { categoryId, fields: [] },
    { categoryId: "cat:electronics", fields: requirements.fields },
    { categoryId, fields: [...requirements.fields, ...requirements.fields] },
    {
      categoryId,
      fields: [{ field: "inventedFit", operator: "equal", value: true }],
    },
    {
      categoryId,
      fields: [{ field: "storageGB", operator: "at_least", value: -1 }],
    },
    { ...requirements, verifiedFit: true },
  ])("rejects invalid or invented hard requirements %#", (raw) => {
    expect(() => parseRequirements(raw)).toThrow();
  });
  it("copies explicit clear IDs rather than aliasing browser input", () => {
    const listingIds = [id];
    const command = parseCompatibilityCommand({
      ...envelope,
      operation: { kind: "clear", listingIds },
    });
    listingIds.length = 0;
    expect(command.operation).toEqual({ kind: "clear", listingIds: [id] });
  });
  it.each([
    {
      ...envelope,
      sellerId: id,
      operation: { kind: "clear", listingIds: [id] },
    },
    {
      ...envelope,
      expectedRevision: -1,
      operation: { kind: "clear", listingIds: [id] },
    },
    {
      ...envelope,
      operation: { kind: "refresh", snapshots: [snapshot, snapshot] },
    },
    {
      ...envelope,
      operation: { kind: "refresh", snapshots: Array(5).fill(snapshot) },
    },
    {
      ...envelope,
      operation: {
        kind: "check",
        requirements,
        snapshots: [
          {
            ...snapshot,
            observation: { ...snapshot.observation, priceMinor: 1.5 },
          },
        ],
      },
    },
    { ...envelope, operation: { kind: "publish" } },
  ])(
    "rejects ambiguous, unbounded or unauthorized compatibility command shape %#",
    (raw) => {
      expect(() => parseCompatibilityCommand(raw)).toThrow();
    },
  );
  it.each([
    "priceMinor",
    "currency",
    "condition",
    "stock",
    "media",
    "warranty",
  ])("rejects helper attempts to edit %s", (field) => {
    expect(() =>
      parseHelperEdit({
        title: "Phone",
        description: "Declared facts",
        categoryId,
        fields: {},
        [field]: "injected",
      }),
    ).toThrow();
  });
  it.each([false, undefined, "true", 1])(
    "requires literal explicit acceptance confirmation %s",
    (confirm) => {
      expect(() =>
        parseHelperCommand({
          ...envelope,
          sellerId: id,
          operation: {
            kind: "accept",
            proposalId: id,
            proposalHash: "b".repeat(64),
            expectedDraftRevision: 1,
            confirm,
          },
        }),
      ).toThrow();
    },
  );
  it("requires seller scope and frozen draft revision on explicit acceptance", () => {
    const raw = {
      ...envelope,
      sellerId: id,
      operation: {
        kind: "accept",
        proposalId: id,
        proposalHash: "b".repeat(64),
        expectedDraftRevision: 3,
        confirm: true,
      },
    };
    expect(parseHelperCommand(raw)).toEqual(raw);
    expect(() => parseHelperCommand({ ...raw, sellerId: undefined })).toThrow();
    expect(() =>
      parseHelperCommand({
        ...raw,
        operation: { ...raw.operation, expectedDraftRevision: 0 },
      }),
    ).toThrow();
  });
});
