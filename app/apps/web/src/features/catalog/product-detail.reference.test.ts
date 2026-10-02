import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readReferenceCatalog } from "./reference/adapter.server";
import { readReferenceProductDetail } from "./reference/product-detail.server";
import { readReferenceProductContext } from "./reference/product-context.server";
import {
  readReferenceProducts,
  readReferenceStores,
} from "./reference/product-source.server";
import { toProductDetailView } from "./product-detail-model";
import { validProductId } from "./product-context-model";

// Model future provider/private columns at every nested object boundary.
function withPrivateFields<T>(value: T): T {
  if (Array.isArray(value))
    return value.map((item) => withPrivateFields(item)) as T;
  if (value && typeof value === "object")
    return {
      ...Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          withPrivateFields(item),
        ]),
      ),
      privateProviderField: "PRIVATE_CANARY_NOT_FOR_BROWSER",
    } as T;
  return value;
}
describe.each([
  "reference-default",
  "home-welcome",
  "product-reporting",
  "kitsch-product-saving-offer",
  undefined,
])("selective reference reads (%s)", (scenario) => {
  it("preserves every known product and seller's first-match ordering and scenario facts", async () => {
    const full = await readReferenceCatalog(scenario);
    const productIds = [...new Set(full.products.map((product) => product.id))];
    const storeIds = [...new Set(full.stores.map((store) => store.id))];
    expect(productIds.every(validProductId)).toBe(true);
    expect(await readReferenceProducts(productIds, scenario)).toEqual(
      productIds.map((id) =>
        full.products.find((product) => product.id === id),
      ),
    );
    expect(await readReferenceStores(storeIds, scenario)).toEqual(
      storeIds.map((id) => full.stores.find((store) => store.id === id)),
    );
  });
});
it("allowlists nested detail, money, variants, cards and seller data at runtime", async () => {
  const full = await readReferenceCatalog();
  const product = full.products.find(
    (product) => product.id === "live-explore-jordan-legend",
  );
  expect(product).toBeDefined();
  if (!product) throw new Error("Known reference product missing");
  const seller = full.stores.find((store) => store.id === product.storeId);
  expect(seller).toBeDefined();
  if (!seller) throw new Error("Known reference seller missing");
  const view = toProductDetailView(
    withPrivateFields(product),
    withPrivateFields(seller),
    full.products.slice(0, 5).map(withPrivateFields),
  );
  const json = JSON.stringify(view);
  expect(json).not.toContain("PRIVATE_CANARY");
  expect(Object.keys(view).sort()).toEqual(["product", "related", "seller"]);
  for (const key of [
    "category",
    "gender",
    "country",
    "shippingDestinations",
    "sourceNewestRank",
    "referenceNewnessRank",
    "saleUnit",
    "referenceThumbnails",
  ])
    expect(view.product).not.toHaveProperty(key);
  for (const key of [
    "referencePolicies",
    "description",
    "categories",
    "coverImage",
    "recommendations",
    "capturedGrid",
  ])
    expect(view.seller).not.toHaveProperty(key);
  expect(view.seller?.policies).toEqual({
    refund: Boolean(seller.referencePolicies?.refund),
    shipping: Boolean(seller.referencePolicies?.shipping),
  });
  expect(view.related).toHaveLength(4);
  for (const card of view.related) {
    expect(card.images.length).toBeLessThanOrEqual(1);
    expect(card).not.toHaveProperty("variants");
    expect(card).not.toHaveProperty("detail");
  }
  expect(view.product.images).toEqual(product.images);
  expect(view.product.variants).toEqual(product.variants);
  expect(view.product.detail).toEqual(product.detail);
});
it("returns bounded detail with the captured recommendation order and overrides", async () => {
  const detail = await readReferenceProductDetail(
    "shea-butter",
    "product-reporting",
  );
  expect(detail?.view.product.detail?.reportNotesMerchant).toEqual({
    ratingCount: "195.3K",
    logoOutline: false,
  });
  expect(detail?.view.related.map((product) => product.id)).toEqual([
    "chocolate-body-bag",
    "sugar-body-scrub",
    "solid-shave-butter",
    "charcoal-body-wash",
  ]);
  expect(detail?.view.related[0]).toMatchObject({
    title: "Chocolate Body Wash Bar Bag",
    ratingCount: "748",
    promotion: "$20 off order",
  });
  const bag = await readReferenceProductDetail(
    "shampoo-bag",
    "reference-default",
  );
  expect(bag?.view.related.map((product) => product.images)).toEqual([
    ["/api/reference-media/pdp-bag-black-conditioner-bag-recommendation"],
    ["/api/reference-media/pdp-bag-chocolate-body-bag-recommendation"],
  ]);
});
it("retains native variants, reviews, gallery and only the first four seller recommendations", async () => {
  const full = await readReferenceCatalog();
  const detail = await readReferenceProductDetail("live-explore-jordan-legend");
  expect(detail).toBeDefined();
  if (!detail) throw new Error("Known detail missing");
  const original = full.products.find(
    (product) => product.id === detail.view.product.id,
  );
  expect(detail.view.product.variants).toEqual(original?.variants);
  expect(detail.view.product.images).toEqual(original?.images);
  const expected = detail.view.seller
    ? full.products
        .filter(
          (product) =>
            product.storeId === detail.view.product.storeId &&
            product.id !== detail.view.product.id,
        )
        .slice(0, 4)
    : [];
  expect(detail.view.related.map((product) => product.id)).toEqual(
    expected.map((product) => product.id),
  );
});
it("keeps missing items absent in frozen and live modes", async () => {
  expect(
    await readReferenceProductDetail(
      "not-a-reference-product",
      "reference-default",
    ),
  ).toBeUndefined();
  expect(
    await readReferenceProductDetail("not-a-reference-product"),
  ).toBeUndefined();
  expect(
    await readReferenceProductDetail(
      "live-explore-jordan-legend",
      "reference-default",
    ),
  ).toBeUndefined();
});
it("resolves cart and collection inputs without full records or unrelated sellers", async () => {
  const context = await readReferenceProductContext(
    "shea-butter",
    {
      cartIds: ["rice-bundle", "unknown"],
      coverIds: ["rice-bundle", "not-found"],
    },
    "reference-default",
  );
  expect(context.resolvedCartIds).toContain("unknown");
  expect(context.resolvedCoverIds).toContain("not-found");
  expect(context.covers).toEqual([
    expect.objectContaining({ id: "rice-bundle", image: expect.any(String) }),
  ]);
  expect(context.cart.products.map((product) => product.id)).toEqual([
    "shea-butter",
    "rice-bundle",
    "black-conditioner-bag",
    "chocolate-body-bag",
    "shower-caddy",
    "solid-shave-butter",
  ]);
  expect(context.cart.stores.map((store) => store.id)).toEqual(["kitsch"]);
  for (const product of context.cart.products) {
    expect(product).not.toHaveProperty("description");
    expect(product).not.toHaveProperty("detail");
    expect(product).not.toHaveProperty("category");
    expect(product.images.length).toBeLessThanOrEqual(1);
  }
  for (const store of context.cart.stores)
    expect(store).not.toHaveProperty("referencePolicies");
});
it.each([
  ["shea-butter", "reference-default"],
  ["shea-butter", undefined],
  ["live-explore-jordan-legend", undefined],
])(
  "records actual serialized route-model sizes for %s / %s",
  async (id, scenario) => {
    const catalog = await readReferenceCatalog(scenario);
    const product = catalog.products.find((product) => product.id === id);
    const detail = await readReferenceProductDetail(id, scenario);
    if (!product || !detail) throw new Error("Measurement fixture missing");
    const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
    const result = {
      id,
      scenario: scenario ?? "live",
      catalogBytes: bytes(catalog),
      previousPropsBytes: bytes({ product, catalog }),
      detailViewBytes: bytes(detail.view),
      contextBytes: bytes(detail.context),
      nextPropsBytes: bytes({ data: detail }),
    };
    console.info("PRODUCT_DETAIL_MEASUREMENT", JSON.stringify(result));
    expect(result.nextPropsBytes).toBeLessThan(result.previousPropsBytes);
  },
);
