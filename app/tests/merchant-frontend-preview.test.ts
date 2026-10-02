import { describe, expect, it } from "vitest";
import {
  adminPreviewEnabled,
  parsePreviewRoute,
  previewHref,
  previewSections,
  settingsSections,
} from "../apps/web/src/features/sellers/preview/routes";
import {
  initialPreviewState,
  orderTotal,
  parseMoney,
  readPreviewState,
  safePreviewImage,
} from "../apps/web/src/features/sellers/preview/model";
import { parseProductCsv } from "../apps/web/src/features/sellers/preview/imports";
describe("local merchant frontend boundary", () => {
  it("requires explicit local opt-in", () => {
    expect(adminPreviewEnabled({})).toBe(false);
    expect(
      adminPreviewEnabled({
        SHOP_REFERENCE_PREVIEW: "1",
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });
  it.each([
    { NODE_ENV: "production" },
    { VERCEL: "1" },
    { VERCEL_ENV: "production" },
    { SHOP_REFERENCE_PREVIEW: "true" },
  ])("denies hosted/production/non-opt-in %o", (extra) => {
    expect(adminPreviewEnabled({ SHOP_REFERENCE_PREVIEW: "1", ...extra })).toBe(
      false,
    );
  });
  it("accepts all documented pages and only known settings", () => {
    for (const section of previewSections)
      expect(parsePreviewRoute([section])?.section).toBe(section);
    for (const section of settingsSections)
      expect(parsePreviewRoute(["settings", section])?.detail).toBe(section);
    expect(parsePreviewRoute(["settings", "credentials"])).toBeNull();
  });
  it.each([
    ["evil"],
    ["products", ".."],
    ["products", "https://example.com"],
    ["products", "new", "extra"],
    ["products", "a/b"],
  ])("rejects unsupported or external routes %o", (...parts) => {
    expect(parsePreviewRoute(parts)).toBeNull();
  });
  it("normalizes every generated link into the preview namespace", () => {
    expect(previewHref("products/new", "bg", "personal")).toBe(
      "/admin-preview/products/new?lang=bg&store=personal",
    );
    expect(previewHref("home", "other", "other")).toBe(
      "/admin-preview?lang=en&store=studio",
    );
  });
});
describe("synthetic state recovery", () => {
  it.each([false, true])("round trips empty/example state %s", (demo) => {
    const state = initialPreviewState(demo);
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
    expect(state.stores.personal.products).toEqual([]);
  });
  it("keeps stores independent", () => {
    const state = initialPreviewState(true);
    state.stores.studio.settings.name = "Changed";
    expect(state.stores.personal.settings.name).toBe("My personal selling");
    state.stores.studio.products[0].title = "Changed product";
    expect(state.stores.personal.products).toEqual([]);
  });
  it.each([
    null,
    "broken",
    JSON.stringify({ version: 2 }),
    "x".repeat(1000001),
  ])("rejects corrupt or oversize envelopes", (raw) =>
    expect(readPreviewState(raw)).toBeNull(),
  );
  it.each([
    "products",
    "customers",
    "orders",
    "discounts",
    "entries",
    "markets",
    "members",
    "threads",
    "collections",
    "campaigns",
  ])("rejects partial %s records", (group) => {
    const state = initialPreviewState(true);
    (state.stores.studio as unknown as Record<string, unknown>)[group] = [
      { id: "missing-fields" },
    ];
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
  it("rejects invalid order quantities and money", () => {
    const state = initialPreviewState(true);
    state.stores.studio.orders[0].lines[0].quantity = -1;
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
    state.stores.studio.orders[0].lines[0].quantity = 1;
    state.stores.studio.products[0].price = 1.99;
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
  it("rejects duplicate record IDs", () => {
    const state = initialPreviewState(true);
    state.stores.studio.products.push(state.stores.studio.products[0]);
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
  it("does not recover executable or remote image URLs", () => {
    expect(safePreviewImage("javascript:alert(1)")).toBe(false);
    expect(safePreviewImage("https://example.com/photo.jpg")).toBe(false);
    expect(safePreviewImage("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(safePreviewImage("data:image/png;base64,YQ==")).toBe(true);
  });
  it("refuses missing required settings", () => {
    const state = initialPreviewState();
    delete state.stores.studio.settings.name;
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
  it("recovers earlier previews when optional settings are added", () => {
    const state = initialPreviewState(true);
    state.stores.studio.settings.name = "Retained store";
    delete state.stores.studio.settings.orderPrefix;
    delete state.stores.studio.settings.shippingRegions;
    const recovered = readPreviewState(JSON.stringify(state));
    expect(recovered?.stores.studio.settings.name).toBe("Retained store");
    expect(recovered?.stores.studio.settings.orderPrefix).toBe("#");
    expect(recovered?.stores.studio.products).toEqual(
      state.stores.studio.products,
    );
  });
  it("retains earlier discounts while defaulting new applicability fields", () => {
    const state = initialPreviewState(true);
    const discount = state.stores.studio.discounts[0] as unknown as Record<
      string,
      unknown
    >;
    delete discount.appliesTo;
    delete discount.buyQuantity;
    delete discount.getQuantity;
    const recovered = readPreviewState(JSON.stringify(state));
    expect(recovered?.stores.studio.discounts[0]).toMatchObject({
      code: "WELCOME10",
      appliesTo: "All products",
      buyQuantity: 1,
      getQuantity: 1,
    });
  });
});
describe("preview catalog import and money", () => {
  it.each([
    ["24.95", 2495],
    ["0", 0],
    ["12,5", 1250],
    [" 9.01 ", 901],
  ])("parses %s into integer minor units", (input, minor) =>
    expect(parseMoney(input as string)).toBe(minor),
  );
  it.each(["-1", "NaN", "1.999", "1e4", "9,999.00", "10000000"])(
    "rejects %s",
    (input) => expect(parseMoney(input)).toBeNull(),
  );
  it("retains quoted commas and exact prices", () => {
    const result = parseProductCsv(
      'Title,Price,SKU,Quantity,Status\n"Shirt, linen",24.95,LIN-1,8,Draft',
    );
    expect(result.errors).toEqual([]);
    expect(result.products[0]).toMatchObject({
      title: "Shirt, linen",
      price: 2495,
      quantity: 8,
      status: "Draft",
    });
  });
  it("handles multiline quoted cells and doubled quotes", () => {
    const result = parseProductCsv('Title,Price\n"A ""special""\nshirt",9.50');
    expect(result.products[0].title).toBe('A "special"\nshirt');
  });
  it.each([
    "Title,Price\nBroken,-1",
    "Title,Price,Quantity\nBroken,1,1.5",
    "Title,Price,Status\nBroken,1,Published",
    'Title,Price\n"Broken,1',
    "SKU\nA",
    "Title,Price",
  ])("rejects incomplete/invalid imports", (input) =>
    expect(parseProductCsv(input).errors.length).toBeGreaterThan(0),
  );
  it("uses the accepted line prices to calculate order totals", () => {
    const state = initialPreviewState(true);
    state.stores.studio.products[0].price = 100000;
    expect(orderTotal(state.stores.studio.orders[0])).toBe(5390);
  });
});
