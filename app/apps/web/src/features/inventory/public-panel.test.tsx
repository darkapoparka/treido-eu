import { describe, expect, it, vi } from "vitest";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import type { PublicInventory } from "./model";
vi.mock("./actions", () => ({ readPublicInventoryAction: vi.fn() }));
vi.mock("../buyer-cart/mutation-button", () => ({ CartMutationButton: () => null }));
vi.mock("../discovery/product-price-summary", () => ({ ProductPriceSummary: () => null }));
import { PublicInventoryPanel } from "./public-panel";
const product = { id: "10000000-0000-4000-8000-000000000001" } as ProductDetailProduct;
const inventory: PublicInventory = {
  mode: "stocked", state: "available", publicationRevision: 3,
  skus: [{ id: "20000000-0000-4000-8000-000000000001", options: {}, priceMinor: 1200, available: 2, onHand: 2 }],
};
describe("public stock publication lifetime", () => {
  it("preserves component state within the same product/publication", () => {
    const props = { product, revision: 3, initial: inventory };
    const first = PublicInventoryPanel(props), rerender = PublicInventoryPanel({ ...props });
    expect(first.type).toBe(rerender.type);
    expect(first.key).toBe(rerender.key);
    expect(first.props.initial).toBe(inventory);
  });
  it("changes identity before rendering another product or publication", () => {
    const first = PublicInventoryPanel({ product, revision: 3, initial: inventory });
    expect(PublicInventoryPanel({ product, revision: 4, initial: { ...inventory, publicationRevision: 4 } }).key).not.toBe(first.key);
    expect(PublicInventoryPanel({ product: { ...product, id: "10000000-0000-4000-8000-000000000002" }, revision: 3, initial: inventory }).key).not.toBe(first.key);
  });
  it("does not display a stale publication's price, stock or variant selection", () => {
    const current = PublicInventoryPanel({ product, revision: 4, initial: inventory, allowCart: false });
    expect(current.props.initial).toBeNull();
    expect(current.props.allowCart).toBe(false);
    expect(PublicInventoryPanel({ product, revision: 3, initial: null }).props.initial).toBeNull();
  });
});
