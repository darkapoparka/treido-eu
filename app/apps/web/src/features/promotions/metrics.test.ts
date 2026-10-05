import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const f = vi.hoisted(() => ({
  authorize: vi.fn(),
  campaign: vi.fn(),
  eligible: vi.fn(),
  policy: vi.fn(),
  environment: "production",
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: (database: { tx: unknown }, work: (tx: unknown) => unknown) =>
    work(database.tx),
}));
vi.mock("../sellers/persistence.server", () => ({
  authorizeHuman: f.authorize,
}));
vi.mock("../catalog/public-discovery.server", () => ({
  publicDiscoveryKey: () => Buffer.alloc(32, 8),
}));
vi.mock("../../server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({ environment: f.environment }),
}));
vi.mock("./payment-bridge.server", () => ({
  promotionPaymentBridge: () => ({
    binding: {
      platformAccount: "acct_isolated",
      environment: "production",
      applicationId: "isolated",
      livemode: true,
    },
  }),
}));
vi.mock("./projection.server", () => ({
  verifyPlacement: () => ({
    campaignId: "campaign",
    listingId: "listing",
    listingRevision: 3,
    placementId: "placement",
  }),
}));
vi.mock("./eligibility.server", () => ({
  currentEligible: f.eligible,
  promotionAvailability: "current_stock",
}));
vi.mock("./storage.server", () => ({
  campaign: f.campaign,
  databaseTime: () => new Date("2026-10-04T12:00:00.000Z"),
}));
vi.mock("../inventory/public-sql", () => ({ publicInventoryJoin: "" }));
vi.mock("./measurement-policy.server", () => ({
  approvedMeasurementPolicy: f.policy,
}));
import { measuredTraffic, recordPromotionMetric } from "./metrics.server";
import type { SellerDatabase } from "../../server/db/database";
const identity = { subject: "user_isolated" };
function transport(
  options: {
    allowed?: boolean;
    operator?: boolean;
    internal?: boolean;
    eligible?: boolean;
    impression?: boolean;
    inserted?: boolean;
  } = {},
) {
  const query = vi.fn(async (sql: string, ...parameters: unknown[]) => {
    void parameters;
    return {
      rows: sql.includes("FROM treido.promotion_measurement_choices")
        ? [{ allowed: options.allowed ?? true }]
        : sql.includes("lock_operator_grant")
          ? [{ allowed: options.operator ?? false }]
          : sql.startsWith("SELECT pc.seller_id")
            ? [{ sellerId: "seller", internal: options.internal ?? false }]
            : sql.startsWith("SELECT pc.id")
              ? options.eligible === false
                ? []
                : [{ id: "campaign" }]
              : sql.startsWith("SELECT 1 FROM treido.promotion_metrics")
                ? options.impression
                  ? [{ present: true }]
                  : []
                : [],
      rowCount: options.inserted === false ? 0 : 1,
    };
  });
  return {
    query,
    database: { tx: { client: { query } } } as unknown as SellerDatabase,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  f.environment = "production";
  f.authorize.mockResolvedValue({ id: "own-user" });
  f.policy.mockResolvedValue({ id: "policy", retentionDays: 30 });
  f.campaign.mockResolvedValue({
    id: "campaign",
    state: "active",
    listingId: "listing",
    productId: "home_spotlight_7d_v1",
  });
  f.eligible.mockResolvedValue({ id: "listing", revision: 3 });
});
describe("honest explicit-consent measured subset (transport, not real browser attention)", () => {
  it.each(["", "HeadlessChrome", "Playwright", "crawler", "test-agent"])(
    "excludes unqualified traffic %s",
    (ua) => expect(measuredTraffic(ua, "production", false)).toBe(false),
  );
  it("requires production non-operator actual user-agent", () => {
    expect(measuredTraffic("Mozilla/5.0", "production", false)).toBe(true);
    expect(measuredTraffic("Mozilla/5.0", "development", false)).toBe(false);
    expect(measuredTraffic("Mozilla/5.0", "production", true)).toBe(false);
  });
  it("unknown event kind cannot query or record", async () => {
    const t = transport();
    await expect(
      recordPromotionMetric(
        t.database,
        identity,
        "token",
        "inquiry",
        "Mozilla/5.0",
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(t.query).not.toHaveBeenCalled();
  });
  it("no currently approved separate policy records no optional event", async () => {
    f.policy.mockResolvedValue(null);
    const t = transport();
    expect(
      await recordPromotionMetric(
        t.database,
        identity,
        "token",
        "impression",
        "Mozilla/5.0",
      ),
    ).toEqual({ recorded: false });
    expect(t.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("latest explicit withdrawal records no optional event", async () => {
    const t = transport({ allowed: false });
    expect(
      await recordPromotionMetric(
        t.database,
        identity,
        "token",
        "impression",
        "Mozilla/5.0",
      ),
    ).toEqual({ recorded: false });
    const [sql, args] = t.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("ORDER BY revision DESC");
    expect(args).toEqual(["own-user", "policy"]);
    expect(t.query.mock.calls.some(([s]) => s.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it.each([{ operator: true }, { internal: true }, { eligible: false }])(
    "operator/self/current ineligible events never increase counts %#",
    async (options) => {
      const t = transport(options);
      expect(
        await recordPromotionMetric(
          t.database,
          identity,
          "token",
          "impression",
          "Mozilla/5.0",
        ),
      ).toEqual({ recorded: false });
      expect(t.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
        false,
      );
    },
  );
  it("changed observed publication revision records nothing", async () => {
    f.eligible.mockResolvedValue({ id: "listing", revision: 4 });
    const t = transport();
    expect(
      await recordPromotionMetric(
        t.database,
        identity,
        "token",
        "impression",
        "Mozilla/5.0",
      ),
    ).toEqual({ recorded: false });
    expect(t.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("product click cannot precede accepted visible impression", async () => {
    const t = transport();
    expect(
      await recordPromotionMetric(
        t.database,
        identity,
        "token",
        "click",
        "Mozilla/5.0",
      ),
    ).toEqual({ recorded: false });
    expect(t.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(
      false,
    );
  });
  it("accepted event retains only campaign/placement/type and exact reviewed expiry, with same current paid predicates", async () => {
    const t = transport();
    expect(
      await recordPromotionMetric(
        t.database,
        identity,
        "token",
        "impression",
        "Mozilla/5.0",
      ),
    ).toEqual({ recorded: true });
    const calls = t.query.mock.calls as unknown as [string, unknown[]][];
    const [sql, args] = calls.find(([s]) => s.startsWith("INSERT"))!;
    expect(sql).toContain(
      "campaign_id,placement_id,kind,policy_version,expires_at",
    );
    expect(args).toEqual([
      "campaign",
      "placement",
      "impression",
      new Date("2026-11-03T12:00:00.000Z"),
    ]);
    expect(args).not.toContain("own-user");
    const paid = calls.find(([s]) => s.startsWith("SELECT pc.id"))![0];
    for (const fragment of [
      "pb.revoked_at IS NULL",
      "cb.revoked_at IS NULL",
      "pr.listing_revision=p.revision",
      "cap.seller_kind=s.kind",
      "current_stock",
    ])
      expect(paid).toContain(fragment);
  });
  it("same placement/kind dedup reports no new measurement", async () => {
    const t = transport({ inserted: false });
    expect(
      await recordPromotionMetric(
        t.database,
        identity,
        "token",
        "impression",
        "Mozilla/5.0",
      ),
    ).toEqual({ recorded: false });
  });
});
