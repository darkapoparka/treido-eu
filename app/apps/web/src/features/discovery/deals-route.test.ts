import { beforeEach, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ reference: vi.fn() }));
vi.mock("../catalog/queries.server", () => ({
  referencePreviewEnabled: boundary.reference,
}));
vi.mock("./marketplace-deals", () => ({
  MarketplaceDeals: "marketplace-deals",
}));
vi.mock("./deals", () => ({ Deals: "captured-deals" }));
import Page from "../../app/deals/page";

beforeEach(() => vi.clearAllMocks());

it("renders an honest production state instead of captured sellers and discounts", async () => {
  boundary.reference.mockReturnValue(false);
  expect((await Page()).type).toBe("marketplace-deals");
});

it("preserves captured Deals only in the explicitly guarded reference preview", async () => {
  boundary.reference.mockReturnValue(true);
  expect((await Page()).type).toBe("captured-deals");
});
