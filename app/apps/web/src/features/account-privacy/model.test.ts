import { describe, expect, it } from "vitest";
import {
  EXPORT_CATEGORIES,
  decodePending,
  parseDownloadQuery,
  parsePrivacyCommand,
  privacyContinuation,
  PRIVACY_LIMITS,
} from "./model";
import { buildSnapshot, snapshotSection } from "./snapshot";
import { privacyCopy } from "./copy";
const id = "00000000-0000-4000-8000-000000000001",
  actorKey = "a".repeat(64);
const base = {
  version: 1,
  actorKey,
  requestId: id,
  expectedRevision: 3,
  operation: { kind: "review" },
};
describe("human privacy input and exact recovery boundaries", () => {
  it.each([
    null,
    {},
    { ...base, version: 2 },
    { ...base, subject: "user_other" },
    { ...base, sellerId: id },
    { ...base, actorKey: "user_test" },
    { ...base, actorKey: actorKey + "\n" },
    { ...base, requestId: id + "\n" },
    { ...base, requestId: "request" },
    { ...base, expectedRevision: -1 },
    { ...base, expectedRevision: 0.5 },
    { ...base, expectedRevision: 2_147_483_647 },
    { ...base, operation: { kind: "complete" } },
    { ...base, operation: { kind: "delete" } },
    {
      ...base,
      operation: { kind: "submit", reviewId: id, acknowledged: false },
    },
    {
      ...base,
      operation: {
        kind: "submit",
        reviewId: id,
        acknowledged: true,
        retentionApproved: true,
      },
    },
    { ...base, operation: { kind: "export", categories: [] } },
    {
      ...base,
      operation: { kind: "export", categories: ["account", "account"] },
    },
    {
      ...base,
      operation: { kind: "export", categories: ["providerPayloads"] },
    },
  ])("rejects forged scope, incomplete review or destructive input %#", (raw) =>
    expect(() => parsePrivacyCommand(raw)).toThrow("INVALID_INPUT"),
  );
  it("canonicalizes category order without changing original request/revision", () => {
    const command = parsePrivacyCommand({
      ...base,
      operation: { kind: "export", categories: ["searches", "account"] },
    });
    expect(command.operation).toEqual({
      kind: "export",
      categories: ["account", "searches"],
    });
    expect(decodePending(JSON.stringify(command))).toEqual(command);
    expect(command.expectedRevision).toBe(3);
    expect(command.requestId).toBe(id);
  });
  it.each([
    "bad",
    "x".repeat(PRIVACY_LIMITS.recoveryBytes + 1),
    JSON.stringify({ ...base, snapshot: { secret: "other data" } }),
  ])("does not recover arbitrary private browser data %#", (value) =>
    expect(decodePending(value)).toBeNull(),
  );
  it.each([
    "https://evil.invalid/account/privacy/data",
    "//evil.invalid/account/privacy/data",
    "/account/privacy/data?lang=bg&lang=en",
    "/account/privacy/download?id=" + id,
    "/account/privacy/data?lang=fr",
    "/account/privacy/data#complete",
    "/account/privacy/data?complete=1",
    "/account/privacy/data/",
    "/account/privacy/data\n",
    "/account/privacy/%64ata",
    "/account/privacy/data?lang=en&sellerId=" + id,
  ])("rejects unsafe or action-bearing continuations %#", (value) =>
    expect(privacyContinuation(value)).toBeNull(),
  );
  it.each([
    "/account/privacy/data",
    "/account/privacy/data?lang=bg",
    "/account/privacy/data?lang=en",
  ])("accepts exactly a known read-only continuation %s", (value) =>
    expect(privacyContinuation(value)).toBe(value),
  );
  it("binds a download to an explicit actor and rejects duplicate/extra inputs", () => {
    expect(
      parseDownloadQuery(new URLSearchParams({ id, actor: actorKey })),
    ).toEqual({ id, actorKey });
    for (const query of [
      "id=" + id,
      "id=" + id + "&id=" + id + "&actor=" + actorKey,
      "id=" + id + "&actor=" + actorKey + "&user=" + id,
    ])
      expect(() => parseDownloadQuery(new URLSearchParams(query))).toThrow(
        "INVALID_INPUT",
      );
  });
});
describe("bounded data minimization", () => {
  it("drops credentials, counterpart contact details and raw provider objects even if a query accidentally returns them", () => {
    const section = snapshotSection("purchases", [
      {
        kind: "order",
        id,
        state: "paid",
        currency: "EUR",
        totalMinor: 1500,
        providerPayload: { token: "secret" },
        buyerEmail: "other@example.invalid",
        messages: "private counterpart",
        createdAt: new Date("2026-10-04T10:00:00Z"),
      },
    ]);
    const serialized = JSON.stringify(
      buildSnapshot(id, "2026-10-04T10:01:00Z", [section]),
    );
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("other@example.invalid");
    expect(serialized).not.toContain("private counterpart");
    expect(section.records[0]).toMatchObject({
      totalMinor: 1500,
      createdAt: "2026-10-04T10:00:00.000Z",
    });
  });
  it("caps a section and discloses omitted history instead of silently exporting every row", () => {
    const section = snapshotSection(
      "account",
      Array.from({ length: 60 }, () => ({ id, status: "active" })),
    );
    expect(section.records).toHaveLength(50);
    expect(section.limited).toBe(true);
  });
  it("exports own order support/refund/feedback summaries while excluding private event and counterpart fields", () => {
    const section = snapshotSection("purchases", [
      {
        kind: "orderSupportCase",
        id,
        orderId: id,
        state: "open",
        revision: 2,
        body: "private case body",
        evidence: ["private evidence"],
        sellerId: "private business",
      },
      {
        kind: "orderRefundRequest",
        id,
        orderId: id,
        amountMinor: 1500,
        currency: "EUR",
        state: "unknown",
        providerPayload: "private provider",
        transferId: "private transfer",
      },
      {
        kind: "orderFeedback",
        id,
        orderId: id,
        rating: 4,
        state: "pending",
        revision: 1,
        body: "private review body",
        moderationReason: "private reason",
      },
    ]);
    expect(section.records[0]).toMatchObject({
      kind: "orderSupportCase",
      state: "open",
      revision: 2,
    });
    expect(section.records[1]).toMatchObject({
      amountMinor: 1500,
      currency: "EUR",
      state: "unknown",
    });
    expect(section.records[2]).toMatchObject({ rating: 4, state: "pending" });
    expect(JSON.stringify(section)).not.toContain("private");
  });
  it("exports current own preference and closure summaries without provider or session targets", () => {
    const section = snapshotSection("account", [
      { id, status: "active" },
      {
        kind: "accountPreferences",
        locale: "bg",
        browseScope: "personal",
        providerId: "secret-provider",
      },
      {
        kind: "accountClosure",
        state: "accepted",
        policyVersion: "reviewed-v1",
        acceptedAt: "2026-10-04T10:00:00Z",
        subject: "secret-subject",
        sessionId: "secret-session",
        target: { objectKey: "private-media" },
      },
    ]);
    expect(section.records[0].id).toBe(id);
    expect(section.records[1]).toMatchObject({
      kind: "accountPreferences",
      locale: "bg",
      browseScope: "personal",
    });
    expect(section.records[2]).toMatchObject({
      state: "accepted",
      policyVersion: "reviewed-v1",
      acceptedAt: "2026-10-04T10:00:00Z",
    });
    expect(JSON.stringify(section)).not.toMatch(
      /secret|private-media|objectKey|sessionId|subject|providerId/,
    );
  });
  it("preserves real canonical saved-search criteria while bounding large sections", () => {
    const query = "q=phone&condition=used&seller=personal&maxPrice=500&lang=bg";
    expect(
      snapshotSection("searches", [
        {
          id,
          criteriaQuery: query,
          criteriaMode: "find-for-me",
          criteriaRegistry: 1,
        },
      ]).records[0].criteriaQuery,
    ).toBe(query);
    const section = snapshotSection(
      "searches",
      Array.from({ length: 50 }, () => ({
        id,
        criteriaQuery: "x".repeat(6000),
      })),
    );
    expect(section.records.length).toBeGreaterThan(0);
    expect(section.records.length).toBeLessThan(50);
    expect(section.limited).toBe(true);
    expect(
      new TextEncoder().encode(
        JSON.stringify(buildSnapshot(id, "2026-10-04T00:00:00Z", [section])),
      ).byteLength,
    ).toBeLessThan(PRIVACY_LIMITS.bytes);
  });
  it("exports current input-processing choices without exporting prompts, media or provider identifiers", () => {
    const section = snapshotSection("searches", [
      {
        kind: "assistant-input",
        status: "proposal",
        criteriaMode: "assistant-voice",
        criteriaQuery: "q=phone&seller=personal&condition=used&lang=bg",
        generation: 2,
        processingConsent: false,
        consentAt: "2026-10-04T10:00:00Z",
        processingConsentExpiresAt: "2026-10-05T00:00:00Z",
        prompt: "private prompt",
        transcript: "private transcript",
        objectKey: "private voice recording",
        providerId: "private provider identifier",
      },
    ]);
    expect(section.records[0]).toMatchObject({
      criteriaMode: "assistant-voice",
      criteriaQuery: "q=phone&seller=personal&condition=used&lang=bg",
      processingConsent: false,
      consentAt: "2026-10-04T10:00:00Z",
      processingConsentExpiresAt: "2026-10-05T00:00:00Z",
    });
    expect(JSON.stringify(section)).not.toContain("private");
  });
  it("refuses unsupported nested values and non-integer monetary values in selected columns", () => {
    expect(() => snapshotSection("purchases", [{ totalMinor: 1.2 }])).toThrow(
      "NOT_AVAILABLE",
    );
    expect(() =>
      snapshotSection("account", [{ status: { secret: "payload" } }]),
    ).toThrow("NOT_AVAILABLE");
  });
  it("keeps bounded own shipping metadata while excluding a third person's recipient and private financial records", () => {
    const section = snapshotSection("purchases", [
      {
        kind: "shippingChoice",
        id,
        state: "bound",
        language: "bg",
        currency: "EUR",
        totalMinor: 13500,
        createdAt: "2026-10-04T00:00:00Z",
        recipient: {
          name: "private recipient",
          address: "private address",
          phone: "private phone",
        },
        buyerId: "private buyer",
        carrierBinding: "private provider",
        sellerId: "private counterpart",
        snapshot: { secret: "private accepted terms" },
      },
    ]);
    expect(section.records[0]).toMatchObject({
      kind: "shippingChoice",
      id,
      state: "bound",
      language: "bg",
      currency: "EUR",
      totalMinor: 13500,
    });
    expect(JSON.stringify(section)).not.toContain("private");
  });
  it("exports supplied assistant context and minimal observation metadata without historical product content", () => {
    const brief = JSON.stringify({
      version: 1,
      occasion: "birthday",
      age: "adult",
      neededBy: null,
      criteria: "reviewed criteria",
    });
    const section = snapshotSection("searches", [
      {
        kind: "giftWorkspace",
        id,
        context: brief,
        selection: id,
        snapshot: { title: "withdrawn title", media: "restricted media" },
        providerPayload: { token: "secret" },
      },
      { kind: "giftObservation", id, listingId: id, publicationRevision: 3 },
    ]);
    expect(section.records[0].context).toBe(brief);
    expect(section.records[0].selection).toBe(id);
    expect(section.records[1].publicationRevision).toBe(3);
    expect(JSON.stringify(section)).not.toMatch(
      /withdrawn title|restricted media|secret/,
    );
    expect(() =>
      snapshotSection("searches", [{ context: "x".repeat(16001) }]),
    ).toThrow("NOT_AVAILABLE");
  });
  it("has matching BG/EN controls and labels for every supported category and obligation", () => {
    expect(Object.keys(privacyCopy.bg)).toEqual(Object.keys(privacyCopy.en));
    expect(Object.keys(privacyCopy.bg.categories)).toEqual([
      ...EXPORT_CATEGORIES,
    ]);
    expect(Object.keys(privacyCopy.bg.facts)).toEqual(
      Object.keys(privacyCopy.en.facts),
    );
    expect(privacyCopy.en.pendingEffects).toContain("unavailable");
  });
});
