import { beforeEach, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  reference: vi.fn(),
  catalogue: vi.fn(),
}));
vi.mock("../catalog/queries.server", () => ({
  referencePreviewEnabled: boundary.reference,
  readCatalog: boundary.catalogue,
}));
vi.mock("./marketplace-page.server", () => ({
  MarketplacePage: "marketplace-page",
}));
vi.mock("./explore", () => ({ Explore: "captured-explore" }));
import Page from "../../app/explore/page";

beforeEach(() => vi.clearAllMocks());

it("opens real categorized discovery without invoking the reference catalogue", async () => {
  boundary.reference.mockReturnValue(false);
  const source = { lang: "bg", seller: "business", condition: "good" };
  const page = await Page({ searchParams: Promise.resolve(source) });
  expect(page.type).toBe("marketplace-page");
  expect(page.props.raw).toEqual(source);
  expect(boundary.catalogue).not.toHaveBeenCalled();
});

it("preserves the captured Explore only behind the explicit reference guard", async () => {
  boundary.reference.mockReturnValue(true);
  const catalogue = { products: [], stores: [] };
  boundary.catalogue.mockResolvedValue(catalogue);
  const page = await Page({ searchParams: Promise.resolve({ lang: "en" }) });
  expect(page.type).toBe("captured-explore");
  expect(page.props.catalog).toBe(catalogue);
  expect(boundary.catalogue).toHaveBeenCalledTimes(1);
});
