import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const f = vi.hoisted(() => ({
  campaign: vi.fn(),
  time: vi.fn(),
  policy: vi.fn(),
  payment: vi.fn(),
  capacity: vi.fn(),
  eligible: vi.fn(),
  lock: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: (database: { tx: unknown }, work: (tx: unknown) => unknown) =>
    work(database.tx),
}));
vi.mock("../../server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: () => false,
}));
vi.mock("../sellers/persistence.server", () => ({
  authorizeHuman: vi.fn(),
  authorizeSeller: vi.fn(),
}));
vi.mock("./storage.server", () => ({
  campaign: f.campaign,
  databaseTime: f.time,
  approvedProduct: f.policy,
  approvedPromotionPayment: f.payment,
  capacity: f.capacity,
  lockPublication: f.lock,
}));
vi.mock("./eligibility.server", () => ({ currentEligible: f.eligible }));
import {
  createPromotionPayment,
  applyPromotionObservation,
  cancelUnattemptedPromotion,
  safeCheckoutUrl,
  operatorPausePromotion,
} from "./provider.server";
import type {
  SellerDatabase,
  SellerTransaction,
} from "../../server/db/database";
import type { PromotionPaymentBridge } from "./payment-bridge.server";
const id = "00000000-0000-4000-8000-000000000001",
  binding = {
    platformAccount: "acct_isolated",
    environment: "test",
    applicationId: "isolated",
    livemode: false,
  };
const intent = {
  purpose: "promotion" as const,
  attemptId: id,
  campaignId: id,
  sellerId: id,
  productId: "category_spotlight_7d_v1",
  totalMinor: 399,
  currency: "EUR" as const,
  ...binding,
  idempotencyKey: "immutable:" + id,
  checkoutExpiresAt: "2026-10-04T12:45:00.000Z",
  language: "bg" as const,
};
const fact = {
  ...intent,
  providerId: "pi_isolated",
  checkoutSessionId: "cs_test_isolated",
  eventId: "evt_isolated",
  authoritativeAt: "2026-10-04T12:00:00Z",
  state: "paid" as const,
  evidenceHash: "a".repeat(64),
};
beforeEach(() => {
  vi.clearAllMocks();
  f.campaign.mockResolvedValue({
    id,
    state: "awaiting_payment",
    reason: null,
    productId: intent.productId,
    listingId: id,
  });
  f.time.mockResolvedValue(new Date("2026-10-04T12:00:01Z"));
});
function transport(
  state: string,
  prior?: unknown,
  latest?: Date,
  receipt?: unknown,
) {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.startsWith("UPDATE treido.promotion_campaigns")
      ? [{ revision: 2 }]
      : sql.includes("FROM treido.promotion_attempts")
        ? [
            {
              id,
              sellerId: id,
              campaignId: id,
              state,
              providerId: null,
              checkoutSessionId: null,
              intent,
            },
          ]
        : sql.includes("FROM treido.promotion_checkout_intents")
          ? receipt
            ? [receipt]
            : []
          : sql.includes("SELECT evidence_hash")
            ? prior
              ? [prior]
              : []
            : sql.includes("SELECT authoritative_at")
              ? latest
                ? [{ at: latest }]
                : []
              : [],
    rowCount: 1,
  }));
  return {
    query,
    tx: { client: { query } } as unknown as SellerTransaction,
    database: { tx: { client: { query } } } as unknown as SellerDatabase,
  };
}
describe("trusted promotion provider boundary (transport tests, no actual Stripe/native claim)", () => {
  it.each([
    "creating",
    "reconciling",
    "pending",
    "paid",
    "cancelled",
    "quarantined",
  ])("never reposts %s even after provider key retention", async (state) => {
    const t = transport(state),
      bridge = {
        binding,
        create: vi.fn(),
        observe: vi.fn(),
      } as unknown as PromotionPaymentBridge;
    await createPromotionPayment(t.database, id, bridge);
    expect(bridge.create).not.toHaveBeenCalled();
  });
  it.each([
    { ...fact, purpose: "item" },
    { ...fact, evidenceHash: "bad" },
    { ...fact, eventId: "redirect_success" },
    { ...fact, providerId: "cs_wrong_purpose" },
    { ...fact, authoritativeAt: "invalid" },
  ])(
    "rejects invalid authoritative observation before any SQL %#",
    async (raw) => {
      const t = transport("pending");
      await expect(
        applyPromotionObservation(
          t.tx,
          id,
          { binding } as PromotionPaymentBridge,
          raw as typeof fact,
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(t.query).not.toHaveBeenCalled();
    },
  );
  it.each([
    "sellerId",
    "campaignId",
    "attemptId",
    "productId",
    "totalMinor",
    "currency",
    "platformAccount",
    "environment",
    "applicationId",
    "livemode",
  ])("rejects mismatched %s before receipt/state change", async (key) => {
    const t = transport("pending"),
      changed = {
        ...fact,
        [key]: key === "totalMinor" ? 1 : key === "livemode" ? true : "foreign",
      };
    await expect(
      applyPromotionObservation(
        t.tx,
        id,
        { binding } as PromotionPaymentBridge,
        changed as typeof fact,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      t.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE)/.test(sql)),
    ).toBe(false);
  });
  it("duplicate verified event cannot restart or extend interval", async () => {
    const t = transport("paid", { hash: fact.evidenceHash, attemptId: id });
    await applyPromotionObservation(
      t.tx,
      id,
      { binding } as PromotionPaymentBridge,
      fact,
    );
    expect(
      t.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE)/.test(sql)),
    ).toBe(false);
  });
  it("out-of-order observation records evidence but cannot change paid state/interval", async () => {
    const t = transport("pending", undefined, new Date("2026-10-04T12:00:02Z"));
    await applyPromotionObservation(
      t.tx,
      id,
      { binding } as PromotionPaymentBridge,
      fact,
    );
    expect(t.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(
      false,
    );
    expect(
      t.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO treido.promotion_intervals"),
      ),
    ).toBe(false);
  });
  it("genuine expired Checkout without any PI can cancel, release and retain only its actual signed event", async () => {
    const t = transport("pending");
    await applyPromotionObservation(
      t.tx,
      id,
      { binding } as PromotionPaymentBridge,
      { ...fact, providerId: null, state: "cancelled" },
    );
    expect(
      t.query.mock.calls.some(([sql]) => sql.includes("status='released'")),
    ).toBe(true);
    expect(
      t.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO treido.promotion_intervals"),
      ),
    ).toBe(false);
  });
  it.each(["paid", "pending", "failed", "refunded", "disputed"] as const)(
    "null PI cannot grant %s provider facts",
    async (state) => {
      const t = transport("pending");
      await expect(
        applyPromotionObservation(
          t.tx,
          id,
          { binding } as PromotionPaymentBridge,
          { ...fact, providerId: null, state },
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(t.query).not.toHaveBeenCalled();
    },
  );
  it("late verified payment after cancellation is quarantined for full review and never revives delivery", async () => {
    const t = transport("cancelled");
    await applyPromotionObservation(
      t.tx,
      id,
      { binding } as PromotionPaymentBridge,
      fact,
    );
    expect(
      t.query.mock.calls.some(([sql]) => sql.includes("state='quarantined'")),
    ).toBe(true);
    expect(
      t.query.mock.calls.some(([sql]) =>
        sql.includes("promotion_remedy_reviews"),
      ),
    ).toBe(true);
    expect(
      t.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO treido.promotion_intervals"),
      ),
    ).toBe(false);
  });
  it("original expired never-attempted intent can stop locally without any fabricated provider evidence", async () => {
    f.time.mockResolvedValue(new Date("2026-10-04T12:45:00Z"));
    const t = transport("creating");
    expect(
      await cancelUnattemptedPromotion(t.tx, id, {
        binding,
      } as PromotionPaymentBridge),
    ).toBe(true);
    expect(
      t.query.mock.calls.some(([sql]) =>
        sql.includes("promotion_provider_events"),
      ),
    ).toBe(false);
    expect(
      t.query.mock.calls.some(([sql]) => sql.includes("status='released'")),
    ).toBe(true);
  });
  it("possibly emitted expired intent stays quarantined when durable first_attempt_at exists", async () => {
    f.time.mockResolvedValue(new Date("2026-10-04T12:45:00Z"));
    const t = transport("reconciling", undefined, undefined, {
      firstAttemptAt: new Date("2026-10-04T12:01:00Z"),
      sessionId: null,
    });
    expect(
      await cancelUnattemptedPromotion(t.tx, id, {
        binding,
      } as PromotionPaymentBridge),
    ).toBe(false);
    expect(
      t.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE)/.test(sql)),
    ).toBe(false);
  });
  it("operator safety stop requires real recent auth before persistence", async () => {
    const t = transport("paid");
    await expect(
      operatorPausePromotion(
        t.database,
        { subject: "user_test" },
        id,
        "safety reason",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(t.query).not.toHaveBeenCalled();
  });
  it("only bounded genuine Stripe Checkout URL can be returned", () => {
    expect(safeCheckoutUrl(null)).toBeNull();
    expect(safeCheckoutUrl("https://checkout.stripe.com/c/pay/test")).toContain(
      "checkout.stripe.com",
    );
    for (const url of [
      "javascript:alert(1)",
      "https://checkout.stripe.com.evil.test/pay",
      "https://user:pass@checkout.stripe.com/pay",
      "http://checkout.stripe.com/pay",
      "https://checkout.stripe.com:444/pay",
    ])
      expect(() => safeCheckoutUrl(url)).toThrow();
  });
});
