import { describe, it, expect } from "vitest";
import {
  PRODUCTS,
  parseCommand,
  validTerms,
  lifecycle,
  deliveryRemedy,
  UUID,
  HEX,
  marketingAllowed,
  type Terms,
} from "./model";
import { placeSponsored } from "./placement";
import type { PublicListingCard } from "../catalog/public-discovery-model";
import { promotionCopy } from "./copy";
const id = "00000000-0000-4000-8000-000000000001";
const command = {
  actorKey: "a".repeat(64),
  sellerId: id,
  requestId: id,
  campaignId: id,
  expectedRevision: 0,
  action: "save",
  listingId: id,
  productId: "category_spotlight_7d_v1",
};
export const terms: Terms = {
  productId: "category_spotlight_7d_v1",
  version: 1,
  totalMinor: 399,
  currency: "EUR",
  durationSeconds: 604800,
  tax: "inclusive",
  automaticRenewal: false,
  cancellation: "seller_stop_no_automatic_refund",
  neverStartedRemedy: "full_refund_review",
  interruptedRemedy: "prorated_review",
  text: {
    bg: "Одобрени само в изолирания тест условия.",
    en: "Terms approved only in the isolated test.",
  },
  approvalReference: "ISOLATED TEST ONLY",
};
describe("strict promotion intent and versioned known totals", () => {
  it("has proposal values only; never derives a paid approval", () => {
    expect(Object.values(PRODUCTS).map((p) => p.proposedMinor)).toEqual([
      99, 399, 799,
    ]);
    expect(validTerms(terms)).toBe(true);
    expect(validTerms({ ...terms, approvalReference: "" })).toBe(false);
  });
  it.each([
    null,
    [],
    {},
    ...Object.keys(command).map((key) => ({ ...command, [key]: undefined })),
    { ...command, amountMinor: 1 },
    { ...command, actorKey: "a".repeat(64) + "\n" },
    { ...command, listingId: id + "\n" },
    { ...command, sellerId: "../other" },
    { ...command, expectedRevision: -1 },
    { ...command, expectedRevision: 0.5 },
    { ...command, productId: "__proto__" },
    { ...command, productId: "other" },
  ])("rejects missing, extra or unbounded input %#", (raw) =>
    expect(() => parseCommand(raw)).toThrow(),
  );
  it("requires exact explicit purchase acknowledgment and no browser price", () => {
    const purchase = {
      actorKey: command.actorKey,
      sellerId: id,
      requestId: id,
      campaignId: id,
      expectedRevision: 2,
      action: "purchase",
      reviewId: id,
      termsHash: "b".repeat(64),
      acknowledged: true,
      language: "bg",
    };
    expect(parseCommand(purchase)).toEqual(purchase);
    for (const raw of [
      { ...purchase, acknowledged: false },
      { ...purchase, acknowledged: "true" },
      { ...purchase, currency: "EUR" },
      { ...purchase, totalMinor: 99 },
      { ...purchase, language: undefined },
      { ...purchase, language: "fr" },
    ])
      expect(() => parseCommand(raw)).toThrow();
  });
  it.each([
    { ...terms, currency: "BGN" },
    { ...terms, totalMinor: 3.99 },
    { ...terms, totalMinor: -1 },
    { ...terms, totalMinor: Number.MAX_SAFE_INTEGER },
    { ...terms, durationSeconds: 3600 },
    { ...terms, automaticRenewal: true },
    { ...terms, feeMinor: 0 },
    { ...terms, version: 0 },
    { ...terms, text: { en: "only" } },
    { ...terms, text: { bg: " ", en: "ok" } },
    { ...terms, neverStartedRemedy: "none" },
    { ...terms, cancellation: "refund_guaranteed" },
  ])("rejects unreviewed or inconsistent product terms %#", (raw) =>
    expect(validTerms(raw)).toBe(false),
  );
  it("keeps stop reason required and bounded", () => {
    for (const reason of ["", " ", "x".repeat(301), "unsafe\nreason"])
      expect(() =>
        parseCommand({
          ...command,
          listingId: undefined,
          productId: undefined,
          action: "pause",
          reason,
        }),
      ).toThrow();
  });
  it("UUID and actor validators reject trailing newline/oversized values", () => {
    expect(UUID(id)).toBe(true);
    expect(UUID(id + "\n")).toBe(false);
    expect(HEX("a".repeat(64) + "\n")).toBe(false);
  });
});
describe("immutable lifecycle and honest remedy bounds", () => {
  const facts = {
    now: 100,
    startsAt: 0,
    endsAt: 200,
    eligible: true,
    approved: true,
    paymentVerified: true,
  };
  it.each(["completed", "cancelled"] as const)(
    "terminal %s never restarts",
    (state) => expect(lifecycle(state, "paid", facts)).toBe(state),
  );
  it("duplicate paid events cannot extend or resume a paused interval", () => {
    expect(lifecycle("paused", "paid", facts)).toBe("paused");
    expect(lifecycle("paused", "recheck", facts)).toBe("active");
  });
  it.each([
    { ...facts, eligible: false },
    { ...facts, approved: false },
  ])("current hard eligibility stops serving %#", (current) =>
    expect(lifecycle("active", "tick", current)).toBe("paused"),
  );
  it("uses server expiry even if reconciliation jobs are late", () =>
    expect(lifecycle("paused", "recheck", { ...facts, now: 200 })).toBe(
      "completed",
    ));
  it("redirect/pending proof never activates a campaign", () =>
    expect(
      lifecycle("awaiting_payment", "paid", {
        ...facts,
        paymentVerified: false,
      }),
    ).toBe("awaiting_payment"));
  it("schedules future interval without changing accepted endpoints", () =>
    expect(
      lifecycle("awaiting_payment", "paid", { ...facts, startsAt: 150 }),
    ).toBe("scheduled"));
  it("full and prorated remedies are review proposals, never refunded flags", () => {
    expect(deliveryRemedy("platform_failure", null, null, 100, 399)).toEqual({
      kind: "full_refund_review",
      maximumMinor: 399,
    });
    expect(deliveryRemedy("platform_failure", 0, 200, 100, 399)).toEqual({
      kind: "prorated_review",
      maximumMinor: 199,
    });
    for (const reason of [
      "seller_choice",
      "listing_unavailable",
      "moderation",
      "expired",
    ] as const)
      expect(deliveryRemedy(reason, null, null, 100, 399)).toBeNull();
  });
  it("marketing and billing stay separate, with no manager default", () => {
    expect(
      marketingAllowed({
        kind: "business",
        owner: false,
        grants: ["billing.manage", "listing.publish"],
        active: true,
      }),
    ).toBe(false);
    expect(
      marketingAllowed({
        kind: "business",
        owner: false,
        grants: ["marketing.manage"],
        active: true,
      }),
    ).toBe(true);
    expect(
      marketingAllowed({
        kind: "business",
        owner: true,
        grants: [],
        active: false,
      }),
    ).toBe(false);
  });
});
describe("bounded labelled placement retains genuine matching organic cards", () => {
  const card = (index: number) => ({ id: String(index) }) as PublicListingCard;
  for (const size of [0, 1, 7, 8, 9, 15, 16, 23, 24])
    it(`caps ${size} cards at one sponsored per eight without duplication`, () => {
      const organic = Array.from({ length: size }, (_, index) => card(index));
      const candidates = organic.map((item) => ({
        listingId: item.id,
        campaignId: "campaign-" + item.id,
        token: "token",
        productId: "category_spotlight_7d_v1" as const,
      }));
      const placed = placeSponsored(organic, candidates);
      expect(placed).toHaveLength(size);
      expect(new Set(placed.map((item) => item.listing.id)).size).toBe(size);
      expect(placed.filter((item) => item.sponsored)).toHaveLength(
        Math.floor(size / 8),
      );
      expect(placed.map((item) => item.listing.id).sort()).toEqual(
        organic.map((item) => item.id).sort(),
      );
      if (size > 0) expect(placed[0].sponsored).toBeNull();
      placed.forEach((item, index) => {
        if (item.sponsored) {
          expect((index + 1) % 8).toBe(0);
          expect(item.sponsored.label).toBe("Sponsored");
          expect(item.sponsored.labelBg).toBe("Спонсорирано");
        }
      });
    });
  it("never inserts foreign supply; a qualified bump signal has a Sponsored disclosure and explicit freshness", () => {
    const organic = Array.from({ length: 8 }, (_, i) => card(i));
    const placements = placeSponsored(organic, [
      {
        campaignId: "x",
        listingId: "foreign",
        token: "t",
        productId: "home_spotlight_7d_v1",
      },
      {
        campaignId: "y",
        listingId: "0",
        token: "t",
        productId: "bump_once_v1",
        promotedFreshnessAt: "2026-10-04T12:00:00Z",
      },
    ]);
    expect(placements.filter((item) => item.sponsored)).toHaveLength(1);
    expect(placements[7].sponsored?.promotedFreshnessAt).toBe(
      "2026-10-04T12:00:00Z",
    );
    expect(placements[7].sponsored?.label).toBe("Sponsored");
  });
  it("all states/reasons/products have BG and EN copy", () => {
    for (const language of ["bg", "en"] as const) {
      const c = promotionCopy(language);
      for (const value of [
        ...Object.values(c.ui),
        ...Object.values(c.products),
        ...Object.values(c.states),
        ...Object.values(c.reasons),
      ])
        expect(value.trim()).not.toBe("");
    }
  });
});
