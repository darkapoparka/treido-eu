import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
vi.mock("server-only", () => ({}));
const f = vi.hoisted(() => ({
  authorize: vi.fn(),
  bill: vi.fn(),
  recent: vi.fn(),
  campaign: vi.fn(),
  time: vi.fn(),
  eligible: vi.fn(),
  lock: vi.fn(),
  review: vi.fn(),
  policy: vi.fn(),
  capacity: vi.fn(),
  payment: vi.fn(),
  enqueue: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: (database: { tx: unknown }, work: (tx: unknown) => unknown) =>
    work(database.tx),
}));
vi.mock("../../server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: f.recent,
}));
vi.mock("./authority.server", () => ({ authorizePromotion: f.authorize }));
vi.mock("../sellers/persistence.server", () => ({
  authorizeSeller: f.bill,
  inputHash: (v: unknown) =>
    createHash("sha256").update(JSON.stringify(v)).digest("hex"),
}));
vi.mock("./eligibility.server", () => ({ currentEligible: f.eligible }));
vi.mock("./storage.server", () => ({
  campaign: f.campaign,
  databaseTime: f.time,
  approvedProduct: f.policy,
  approvedPromotionPayment: f.payment,
  capacity: f.capacity,
  latestReview: f.review,
  lockPublication: f.lock,
  reviewHash: () => "c".repeat(64),
}));
vi.mock("../../server/jobs/outbox.server", () => ({ enqueueJob: f.enqueue }));
import { executePromotion, recoverPromotion } from "./commands.server";
import type { SellerDatabase } from "../../server/db/database";
import type { PromotionPaymentBridge } from "./payment-bridge.server";
import { SellerError } from "../sellers/errors";
const id = "00000000-0000-4000-8000-000000000001",
  key = "a".repeat(64),
  identity = { subject: "user_promo_test" };
const command = {
  actorKey: key,
  sellerId: id,
  requestId: id,
  campaignId: id,
  expectedRevision: 0,
  action: "save" as const,
  listingId: id,
  productId: "category_spotlight_7d_v1" as const,
};
const ack = {
  campaignId: id,
  revision: 1,
  state: "draft",
  reviewId: null,
  attemptId: null,
};
function transport(receipt?: { hash: string; ack: unknown }) {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.includes("SELECT input_hash")
      ? receipt
        ? [receipt]
        : []
      : sql.includes("count(*)")
        ? [{ count: 0 }]
        : [],
    rowCount: 1,
  }));
  return {
    query,
    database: { tx: { client: { query } } } as unknown as SellerDatabase,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  f.authorize.mockResolvedValue({
    user: { id },
    seller: { kind: "personal" },
    context: { capabilities: ["marketing.manage", "billing.manage"] },
    actorKey: key,
  });
  f.recent.mockReturnValue(true);
  f.campaign.mockResolvedValue(null);
  f.time.mockResolvedValue(new Date("2026-10-04T12:00:00Z"));
  f.eligible.mockResolvedValue(null);
  f.lock.mockResolvedValue(undefined);
  f.payment.mockResolvedValue(false);
});
describe("promotion command boundaries via mocked transaction (not native race evidence)", () => {
  it("reads current authority before original receipt, denying revoked membership", async () => {
    f.authorize.mockRejectedValue(new SellerError("FORBIDDEN"));
    const t = transport({ hash: "x", ack });
    await expect(
      executePromotion(t.database, identity, command),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(t.query).not.toHaveBeenCalled();
  });
  it("rejects switched actor command before SQL", async () => {
    const t = transport();
    await expect(
      executePromotion(t.database, identity, {
        ...command,
        actorKey: "b".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(t.query).not.toHaveBeenCalled();
  });
  it("original acknowledged result survives later revisions and cancellation", async () => {
    const hash = createHash("sha256")
        .update(JSON.stringify(command))
        .digest("hex"),
      t = transport({ hash, ack });
    f.campaign.mockResolvedValue({ revision: 99, state: "cancelled" });
    expect(await executePromotion(t.database, identity, command)).toEqual(ack);
    expect(f.campaign).not.toHaveBeenCalled();
    expect(
      t.query.mock.calls.some(([sql]) => /^(UPDATE|INSERT|DELETE)/.test(sql)),
    ).toBe(false);
  });
  it("reused request with changed input is a conflict", async () => {
    const t = transport({ hash: "b".repeat(64), ack });
    await expect(
      executePromotion(t.database, identity, command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.campaign).not.toHaveBeenCalled();
  });
  it("recovery never recreates or mutates a missing attempt", async () => {
    const t = transport();
    expect(await recoverPromotion(t.database, identity, command)).toBeNull();
    expect(f.campaign).not.toHaveBeenCalled();
    expect(t.query.mock.calls.every(([sql]) => sql.startsWith("SELECT"))).toBe(
      true,
    );
  });
  it("recovery acknowledges exact original command only", async () => {
    const t = transport({
      hash: createHash("sha256").update(JSON.stringify(command)).digest("hex"),
      ack,
    });
    expect(await recoverPromotion(t.database, identity, command)).toEqual(ack);
    await expect(
      recoverPromotion(t.database, identity, {
        ...command,
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("stale revisions fail before listing/policy/provider work", async () => {
    f.campaign.mockResolvedValue({ revision: 4, state: "draft" });
    const t = transport();
    await expect(
      executePromotion(t.database, identity, command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.lock).not.toHaveBeenCalled();
  });
  it("draft save alone cannot call or activate a payment", async () => {
    const t = transport(),
      bridge = {
        create: vi.fn(),
        observe: vi.fn(),
      } as unknown as PromotionPaymentBridge;
    expect(
      await executePromotion(t.database, identity, command, bridge),
    ).toEqual(ack);
    expect(bridge.create).not.toHaveBeenCalled();
    expect(bridge.observe).not.toHaveBeenCalled();
    expect(
      t.query.mock.calls.some(([sql]) =>
        sql.includes("INSERT INTO treido.promotion_attempts"),
      ),
    ).toBe(false);
  });
  it("unapproved purchases fail closed despite checkbox and billing permission", async () => {
    f.campaign.mockResolvedValue({
      id,
      revision: 1,
      state: "draft",
      listingId: id,
      productId: command.productId,
    });
    const t = transport(),
      purchase = {
        actorKey: key,
        sellerId: id,
        requestId: id,
        campaignId: id,
        expectedRevision: 1,
        action: "purchase",
        reviewId: id,
        termsHash: "c".repeat(64),
        acknowledged: true,
        language: "bg",
      };
    await expect(
      executePromotion(t.database, identity, purchase, null),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(f.bill).toHaveBeenCalled();
    expect(f.review).not.toHaveBeenCalled();
    expect(
      t.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE)/.test(sql)),
    ).toBe(false);
  });
  it("stale recent authentication blocks a purchase before transaction", async () => {
    f.recent.mockReturnValue(false);
    const t = transport();
    await expect(
      executePromotion(t.database, identity, {
        actorKey: key,
        sellerId: id,
        requestId: id,
        campaignId: id,
        expectedRevision: 1,
        action: "purchase",
        reviewId: id,
        termsHash: "c".repeat(64),
        acknowledged: true,
        language: "bg",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.authorize).not.toHaveBeenCalled();
  });
  it("a foreign listing fails before inserting a draft", async () => {
    f.lock.mockRejectedValue(new SellerError("NOT_FOUND"));
    const t = transport();
    await expect(
      executePromotion(t.database, identity, command),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(t.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("commits original language/45-minute hold/intent before scheduling an observation, without provider POST", async () => {
    const total = {
      productId: command.productId,
      version: 1,
      totalMinor: 399,
      currency: "EUR",
      durationSeconds: 604800,
      tax: "inclusive",
      automaticRenewal: false,
      cancellation: "seller_stop_no_automatic_refund",
      neverStartedRemedy: "full_refund_review",
      interruptedRemedy: "prorated_review",
      text: { bg: "Изолиран тест", en: "Isolated test" },
      approvalReference: "ISOLATED ONLY",
    };
    f.campaign.mockResolvedValue({
      id,
      revision: 1,
      state: "draft",
      listingId: id,
      productId: command.productId,
    });
    f.eligible.mockResolvedValue({
      id,
      revision: 3,
      categoryId: "home.chairs",
      country: "BG",
    });
    f.review.mockResolvedValue({
      id,
      campaignRevision: 1,
      listingRevision: 3,
      termsHash: "c".repeat(64),
      expiresAt: new Date("2026-10-04T12:15:00Z"),
      terms: total,
      policyId: id,
      capacityId: id,
    });
    f.policy.mockResolvedValue({ id, capacityId: id, terms: total });
    f.payment.mockResolvedValue(true);
    f.capacity.mockResolvedValue({
      status: "available",
      reserved: 0,
      slots: 1,
    });
    f.time.mockResolvedValue(new Date("2026-10-04T12:00:00.730Z"));
    const t = transport(),
      bridge = {
        binding: {
          platformAccount: "acct_isolated",
          environment: "test",
          applicationId: "isolated",
          livemode: false,
        },
        create: vi.fn(),
        observe: vi.fn(),
      } as PromotionPaymentBridge;
    const result = await executePromotion(
      t.database,
      identity,
      {
        actorKey: key,
        sellerId: id,
        requestId: id,
        campaignId: id,
        expectedRevision: 1,
        action: "purchase",
        reviewId: id,
        termsHash: "c".repeat(64),
        acknowledged: true,
        language: "en",
      },
      bridge,
    );
    expect(result.state).toBe("awaiting_payment");
    expect(bridge.create).not.toHaveBeenCalled();
    const calls = t.query.mock.calls as unknown as [string, unknown[]][];
    const original = JSON.parse(
      calls.find(([sql]) =>
        sql.includes("INSERT INTO treido.promotion_attempts"),
      )![1][4] as string,
    );
    expect(original).toMatchObject({
      language: "en",
      checkoutExpiresAt: "2026-10-04T12:45:00.000Z",
      totalMinor: 399,
      currency: "EUR",
      purpose: "promotion",
    });
    expect(
      calls.find(([sql]) =>
        sql.includes("INSERT INTO treido.promotion_reservations"),
      )![1][2],
    ).toEqual(new Date(original.checkoutExpiresAt));
    expect(f.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        kind: "promotion.reconcile",
        resourceId: original.attemptId,
        authority: "service",
      }),
    );
  });
});
