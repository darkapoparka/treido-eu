import { describe, expect, it } from "vitest";
import {
  initialPreviewState,
  normalizePreviewFileUrl,
  readPreviewState,
} from "../apps/web/src/features/sellers/preview/model";
import { customerMatchesSegment } from "../apps/web/src/features/sellers/preview/segments-model";
import {
  adminPreviewEnabled,
  parsePreviewRoute,
} from "../apps/web/src/features/sellers/preview/routes";
import {
  validEditorDraft,
  validMenuLink,
  validDraftDate,
  validDraftTime,
  validCompanyAddress,
} from "../apps/web/src/features/sellers/preview/local-draft-model";
import { localExplorationRows } from "../apps/web/src/features/sellers/preview/report-explorer-model";
import { countryOptions } from "../apps/web/src/features/locale/regions";
import {
  blankMetaobjectField,
  schemaKey,
} from "../apps/web/src/features/sellers/preview/metaobject-draft-model";
import { previewSearchItems } from "../apps/web/src/features/sellers/preview/search-model";
import { type GiftCardProductDraft } from "../apps/web/src/features/sellers/preview/gift-card-product-model";
import {
  validDiscountBuyRequirement,
  validDiscountPlanningTargets,
} from "../apps/web/src/features/sellers/preview/discount-eligibility-model";
import {
  procurementTotal,
  type ProcurementDraft,
} from "../apps/web/src/features/sellers/preview/procurement-draft-model";
import {
  reportComparisonRange,
  reportRangeLabel,
} from "../apps/web/src/features/sellers/preview/report-range-model";
import {
  additionalReportPresets,
  remainingReportPresets,
} from "../apps/web/src/features/sellers/preview/report-presets";
import {
  blankProduct,
  emptyStore,
  type Order,
  type Discount,
} from "../apps/web/src/features/sellers/preview/model";

describe("bounded local planning facts", () => {
  it("validates the selected Buy X get Y minimum without requiring a hidden quantity", () => {
    const discount: Discount = {
      ...initialPreviewState(true).stores.studio.discounts[0],
      type: "Buy X get Y",
      buyQuantity: 0,
      buyMinimumKind: "Amount",
      buyMinimumAmountMinor: 1250,
    };
    expect(validDiscountBuyRequirement(discount)).toBe(true);
    for (const patch of [
      { buyMinimumAmountMinor: 0 },
      { buyMinimumAmountMinor: 0.5 },
      { buyMinimumAmountMinor: 100000001 },
      { buyMinimumKind: "Quantity" as const },
    ])
      expect(validDiscountBuyRequirement({ ...discount, ...patch })).toBe(
        false,
      );
    expect(
      validDiscountBuyRequirement({
        ...discount,
        buyMinimumKind: "Quantity",
        buyQuantity: 2,
      }),
    ).toBe(true);
    expect(
      validDiscountBuyRequirement({
        ...discount,
        buyMinimumAmountMinor: undefined,
        buyMinimumAmount: 12.5,
      }),
    ).toBe(true);
  });
  it("persists free Buy X get Y planning with bounded uses and current-store customer targets", () => {
    const state = initialPreviewState(true);
    const store = state.stores.studio;
    const physical = JSON.stringify(store.products);
    const discount: Discount = {
      ...store.discounts[0],
      type: "Buy X get Y",
      status: "Draft",
      valueMode: "Free",
      value: 0,
      maximumPerOrderEnabled: true,
      maximumPerOrder: 2,
      eligibility: "Specific customers",
      eligibilityIds: [store.customers[0].id],
    };
    expect(validDiscountPlanningTargets(discount, store)).toBe(true);
    expect(validDiscountPlanningTargets(discount, state.stores.personal)).toBe(
      false,
    );
    store.discounts[0] = discount;
    expect(
      readPreviewState(JSON.stringify(state))?.stores.studio.discounts[0],
    ).toEqual(discount);
    expect(JSON.stringify(store.products)).toBe(physical);
    for (const patch of [
      { eligibilityIds: [] },
      { eligibilityIds: ["foreign-customer"] },
      { eligibilityIds: [store.customers[0].id, store.customers[0].id] },
      { maximumPerOrder: 0 },
      { maximumPerOrder: 1.5 },
      { maximumPerOrder: 1000000 },
      { value: 10 },
      { type: "Amount off order" },
    ])
      expect(
        validDiscountPlanningTargets({ ...discount, ...patch }, store),
      ).toBe(false);
    for (const patch of [
      { maximumPerOrder: 1.5 },
      { eligibilityIds: ["a", "a"] },
      { value: 10 },
      { getValueMinor: 0.5 },
      { buyMinimumAmountMinor: -1 },
    ]) {
      const invalid = structuredClone(state);
      invalid.stores.studio.discounts[0] = { ...discount, ...patch };
      expect(readPreviewState(JSON.stringify(invalid))).toBeNull();
    }
  });
  it("keeps Buy X get Y amounts in minor units and validates segment and market references", () => {
    const store = initialPreviewState(true).stores.studio;
    store.entries.push({
      id: "segment-local",
      title: "Local segment",
      body: "",
      tags: "",
      type: "Segment",
      status: "Draft",
    });
    const discount: Discount = {
      ...store.discounts[0],
      type: "Buy X get Y",
      valueMode: "Fixed amount",
      value: 0,
      getValueMinor: 125,
      buyMinimumKind: "Amount",
      buyMinimumAmountMinor: 2500,
      eligibility: "Specific customer segments",
      eligibilityIds: ["segment-local"],
    };
    expect(validDiscountPlanningTargets(discount, store)).toBe(true);
    expect(
      validDiscountPlanningTargets(
        {
          ...discount,
          eligibility: "Markets",
          eligibilityIds: [store.markets[0].id],
        },
        store,
      ),
    ).toBe(true);
    expect(
      validDiscountPlanningTargets(
        { ...discount, eligibility: "All customers", eligibilityIds: [] },
        store,
      ),
    ).toBe(true);
    for (const patch of [
      { getValueMinor: 1.25 },
      { getValueMinor: -1 },
      { getValueMinor: 100000001 },
      { buyMinimumAmountMinor: 0 },
      { buyMinimumAmountMinor: 0.25 },
      { eligibility: "Markets", eligibilityIds: ["segment-local"] },
    ])
      expect(
        validDiscountPlanningTargets({ ...discount, ...patch }, store),
      ).toBe(false);
  });
  it("round-trips procurement and stored-value planning while preserving stock and rejecting impossible money or references", () => {
    const state = initialPreviewState(true);
    const product = state.stores.studio.products[0];
    const draft: ProcurementDraft = {
      kind: "PurchaseOrder",
      date: "2026-10-05",
      reference: "Review plan",
      notes: "Local only",
      terms: "30",
      currency: "EUR",
      purchaseOrderId: "",
      lines: [{ productId: product.id, quantity: 2, cost: 500 }],
      adjustments: [
        { id: "shipping-1", kind: "Shipping", amount: 300 },
        { id: "discount-1", kind: "Discount", amount: 100 },
      ],
    };
    expect(procurementTotal(draft)).toEqual({
      subtotal: 1000,
      adjustments: 200,
      total: 1200,
    });
    const transfer = {
      ...draft,
      kind: "Transfer" as const,
      terms: "None" as const,
      adjustments: [],
      purchaseOrderId: "purchase-order-local",
    };
    const gift = {
      kind: "GiftCard" as const,
      code: "DRAFT-REFERENCE",
      value: 1000,
      expiry: "2027-10-05",
      customerId: state.stores.studio.customers[0].id,
      notes: "No issuance",
    };
    for (const [id, type, editorDraft] of [
      ["purchase-order-local", "PurchaseOrderDraft", draft],
      ["transfer-local", "TransferDraft", transfer],
      ["gift-card-local", "GiftCardDraft", gift],
    ] as const)
      state.stores.studio.entries.push({
        id,
        type,
        title: id,
        body: "",
        tags: "",
        status: "Draft",
        editorDraft,
      });
    const restored = readPreviewState(JSON.stringify(state));
    expect(restored).toEqual(state);
    expect(restored?.stores.studio.products[0].quantity).toBe(product.quantity);
    for (const [id, destination] of [
      ["purchase-order-local", "purchase-orders/purchase-order-local"],
      ["transfer-local", "transfers/transfer-local"],
      ["gift-card-local", "gift-cards/gift-card-local"],
    ])
      expect(
        previewSearchItems(state.stores.studio, "en").find(
          (item) => item.title === id,
        )?.destination,
      ).toBe(destination);
    for (const change of [
      { currency: "USD" },
      { lines: [{ productId: product.id, quantity: 0, cost: 500 }] },
      { lines: [{ productId: product.id, quantity: 2, cost: 0.5 }] },
      { adjustments: [{ id: "discount-1", kind: "Discount", amount: 5000 }] },
      { date: "2026-02-30" },
      { lines: [...draft.lines, ...draft.lines] },
    ])
      expect(validEditorDraft({ ...draft, ...change })).toBe(false);
    expect(
      validEditorDraft({ ...transfer, adjustments: draft.adjustments }),
    ).toBe(false);
    expect(validEditorDraft({ ...gift, value: 10.5 })).toBe(false);
    expect(validEditorDraft({ ...gift, code: "../reference" })).toBe(false);
    expect(validEditorDraft({ ...gift, expiry: "2027-02-30" })).toBe(false);
  });
  it("persists bounded discount planning without accepting malformed targeting, amounts, or scheduling", () => {
    const state = initialPreviewState(true);
    const saved = {
      ...state.stores.studio.discounts[0],
      targetKind: "Products" as const,
      targetIds: [state.stores.studio.products[0].id],
      countriesMode: "Selected" as const,
      countryCodes: ["BG", "GR"],
      excludeShippingRate: true,
      maximumShippingRate: 1250,
      limitEnabled: true,
      limit: 3,
      combinations: { product: true, order: false, shipping: true },
      startTime: "09:30",
      endTime: "18:00",
      tags: "local-plan",
    };
    state.stores.studio.discounts[0] = saved;
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
    for (const patch of [
      { targetIds: ["a", "a"] },
      { countryCodes: ["BG", "BG"] },
      { countryCodes: ["XX"] },
      { maximumShippingRate: 1.25 },
      { maximumShippingRate: -1 },
      { startTime: "25:00" },
      { combinations: { product: "true", order: false, shipping: true } },
    ]) {
      const invalid = structuredClone(state);
      invalid.stores.studio.discounts[0] = {
        ...saved,
        ...patch,
      } as typeof saved;
      expect(readPreviewState(JSON.stringify(invalid))).toBeNull();
    }
  });
  it("compares equal inclusive periods and handles leap dates without inventing snapshot history", () => {
    expect(
      reportComparisonRange(
        { start: "2026-09-06", end: "2026-10-05" },
        "previous-period",
      ),
    ).toEqual({ start: "2026-08-07", end: "2026-09-05" });
    expect(
      reportComparisonRange(
        { start: "2024-02-29", end: "2024-02-29" },
        "previous-year",
      ),
    ).toEqual({ start: "2023-02-28", end: "2023-02-28" });
    expect(
      reportComparisonRange(
        { start: "2026-10-05", end: "2026-10-05" },
        "previous-year-weekday",
      ),
    ).toEqual({ start: "2025-10-06", end: "2025-10-06" });
    expect(
      reportComparisonRange(
        { start: "2026-02-30", end: "2026-10-05" },
        "previous-period",
      ),
    ).toBeUndefined();
    expect(
      reportRangeLabel(
        { start: "2026-09-06", end: "2026-10-05" },
        "en",
        "2026-10-05",
      ),
    ).toBe("Last 30 days");
    const draft = {
      kind: "Report",
      metrics: ["orders"],
      start: "2026-09-06",
      end: "2026-10-05",
      dimension: "None",
      visualization: "Metric",
      comparison: "previous-period",
      comparisonStart: "2026-08-07",
      comparisonEnd: "2026-09-05",
    };
    expect(validEditorDraft(draft)).toBe(true);
    expect(validEditorDraft({ ...draft, metrics: ["inventory"] })).toBe(false);
    expect(validEditorDraft({ ...draft, comparisonEnd: "2026-02-30" })).toBe(
      false,
    );
    expect(validEditorDraft({ ...draft, comparison: "none" })).toBe(false);
  });
  it("round trips a hidden page draft without creating a visible public entry", () => {
    const state = initialPreviewState(false);
    const draft = {
      kind: "Page" as const,
      visibility: "Hidden" as const,
      date: "2026-10-05",
      time: "12:30",
      template: "contact" as const,
      seoTitle: "Contact",
      seoDescription: "Local page metadata",
      handle: "contact",
    };
    state.stores.studio.entries.push({
      id: "page-local",
      title: "Contact",
      body: "Local content",
      type: "PageDraft",
      status: "Draft",
      tags: "",
      editorDraft: draft,
    });
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
    expect(
      previewSearchItems(state.stores.studio, "en").find(
        (item) => item.title === "Contact",
      )?.destination,
    ).toBe("pages/page-local");
    expect(validEditorDraft({ ...draft, date: "2026-02-30" })).toBe(false);
    expect(validEditorDraft({ ...draft, template: "remote-theme" })).toBe(
      false,
    );
    expect(
      validEditorDraft({ ...draft, seoDescription: "a".repeat(161) }),
    ).toBe(false);
    expect(validEditorDraft({ ...draft, handle: "../secret" })).toBe(false);
  });
  it("persists nonredeemable gift product plans without changing the physical catalog", () => {
    const state = initialPreviewState(true);
    const products = JSON.stringify(state.stores.studio.products);
    const draft: GiftCardProductDraft = {
      kind: "GiftCardProduct",
      denominations: [1000, 2500, 5000, 10000],
      mediaIds: [],
      productType: "Gift cards",
      vendor: "Local vendor",
      collectionIds: [],
      disclosures: "Local planning",
      seoTitle: "Gift plan",
      seoDescription: "Not issued",
      handle: "gift-plan",
    };
    state.stores.studio.entries.push({
      id: "gift-product-local",
      title: "Gift plan",
      type: "GiftCardProductDraft",
      status: "Draft",
      body: "",
      tags: "",
      editorDraft: draft,
    });
    const restored = readPreviewState(JSON.stringify(state));
    expect(restored).toEqual(state);
    expect(JSON.stringify(restored?.stores.studio.products)).toBe(products);
    expect(
      previewSearchItems(state.stores.studio, "en").find(
        (item) => item.title === "Gift plan",
      )?.destination,
    ).toBe("gift-cards/gift-product-local");
    for (const patch of [
      { denominations: [] },
      { denominations: [1000, 1000] },
      { denominations: [1.5] },
      { denominations: [0] },
      { denominations: [-1] },
      { denominations: [100000001] },
      { mediaIds: ["file", "file"] },
      {
        collectionIds: Array.from({ length: 21 }, (_, i) => `collection-${i}`),
      },
      { handle: "../unsafe" },
      { seoTitle: "x".repeat(71) },
    ])
      expect(validEditorDraft({ ...draft, ...patch })).toBe(false);
  });
  it("keeps local definition fields bounded and rejects duplicate keys and orphan references", () => {
    const state = initialPreviewState(false);
    const draft = {
      kind: "Definition" as const,
      handle: schemaKey("Fabric colors"),
      description: "Local planning",
      activeDraft: true,
      translations: true,
      displayField: "field-1",
      filterFields: ["field-1"],
      fields: [
        {
          ...blankMetaobjectField("field-1"),
          label: "Color name",
          key: "color_name",
          type: "single-line" as const,
          required: true,
          minimum: "1",
          maximum: "30",
          pattern: "^[a-z]+$",
        },
      ],
    };
    state.stores.studio.entries.push({
      id: "definition-local",
      title: "Fabric colors",
      type: "DefinitionDraft",
      status: "Draft",
      body: "",
      tags: "",
      editorDraft: draft,
    });
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
    expect(validEditorDraft({ ...draft, handle: "fabric-colors" })).toBe(true);
    expect(validEditorDraft({ ...draft, handle: "../fabric-colors" })).toBe(
      false,
    );
    expect(
      validEditorDraft({
        ...draft,
        fields: [...draft.fields, { ...draft.fields[0], id: "field-2" }],
      }),
    ).toBe(false);
    expect(validEditorDraft({ ...draft, displayField: "missing" })).toBe(false);
    expect(validEditorDraft({ ...draft, filterFields: ["missing"] })).toBe(
      false,
    );
    expect(
      validEditorDraft({
        ...draft,
        fields: [{ ...draft.fields[0], minimum: "31" }],
      }),
    ).toBe(false);
    expect(
      validEditorDraft({
        ...draft,
        fields: [{ ...draft.fields[0], type: "unsafe-remote-type" }],
      }),
    ).toBe(false);
    expect(
      validEditorDraft({
        ...draft,
        fields: [{ ...draft.fields[0], pattern: "a".repeat(401) }],
      }),
    ).toBe(false);
    expect(validEditorDraft({ ...draft, fields: [] })).toBe(false);
    expect(
      validEditorDraft({
        ...draft,
        fields: [{ ...draft.fields[0], key: "color-name" }],
      }),
    ).toBe(true);
    for (const key of ["../color", "color.name", "a".repeat(65)]) {
      expect(
        validEditorDraft({ ...draft, fields: [{ ...draft.fields[0], key }] }),
      ).toBe(false);
    }
  });
  it("preserves independent buy/get discount selections and rejects malformed local IDs", () => {
    const state = initialPreviewState(false);
    const discount: Discount = {
      id: "local-bundle",
      title: "BUNDLE",
      code: "BUNDLE",
      type: "Buy X get Y",
      method: "Discount code",
      valueMode: "Percentage",
      eligibility: "All customers",
      appliesTo: "Local selections",
      buyQuantity: 2,
      getQuantity: 1,
      minimumKind: "None",
      value: 50,
      minimum: 0,
      limit: 0,
      once: false,
      combines: false,
      start: "2026-10-05",
      end: "",
      status: "Active",
    };
    state.stores.studio.discounts = [discount];
    Object.assign(discount, {
      buyKind: "Products",
      getKind: "Collections",
      buyItemIds: ["local-product-1"],
      getItemIds: ["local-collection-2"],
      buyMinimumKind: "Amount",
      buyMinimumAmount: 25,
    });
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
    discount.getItemIds = ["duplicate", "duplicate"];
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
    discount.getItemIds = ["local-collection-2"];
    discount.buyItemIds = Array.from(
      { length: 101 },
      (_, index) => `product-${index}`,
    );
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
    discount.buyItemIds = ["local-product-1"];
    discount.buyMinimumAmount = -1;
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
  it("keeps every additional report destination valid and unique", () => {
    const presets = [...additionalReportPresets, ...remainingReportPresets];
    expect(presets.length).toBe(167);
    expect(new Set(presets.map(([id]) => id)).size).toBe(presets.length);
    for (const [id] of presets)
      expect(parsePreviewRoute(["reports", id])).toEqual({
        section: "reports",
        detail: id,
      });
  });
  it("restores all selected world regions without truncation and rejects invalid country codes", () => {
    const state = initialPreviewState(false);
    const market = state.stores.studio.markets[0];
    market.countryCodes = countryOptions("en").map((region) => region.code);
    market.countries = countryOptions("en")
      .map((region) => region.name)
      .join(", ");
    expect(market.countryCodes.length).toBeGreaterThan(240);
    expect(market.countries.length).toBeGreaterThan(500);
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
    market.countryCodes = ["BG", "BG"];
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
    market.countryCodes = ["UNKNOWN"];
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
  it("validates real dates and times without scheduling effects", () => {
    expect(validDraftDate("2026-02-30")).toBe(false);
    expect(validDraftDate("2024-02-29")).toBe(true);
    expect(validDraftDate("2026-02-29")).toBe(false);
    expect(validDraftDate("")).toBe(true);
    expect(validDraftTime("24:00")).toBe(false);
    expect(validDraftTime("23:59")).toBe(true);
  });
  it("bounds company address details and the finite region choices", () => {
    const address = {
      country: "Bulgaria",
      address: "",
      city: "",
      postcode: "",
      phone: "",
      first: "Review",
      phoneCountry: "BG",
    };
    expect(validCompanyAddress(address)).toBe(true);
    expect(validCompanyAddress({ ...address, first: "a".repeat(301) })).toBe(
      false,
    );
    expect(validCompanyAddress({ ...address, phoneCountry: "UNKNOWN" })).toBe(
      false,
    );
  });
  it("keeps catalog price adjustments integer and within a nonnegative decrease", () => {
    const catalog = {
      kind: "Catalog",
      marketIds: ["bulgaria"],
      currency: "EUR",
      adjustment: 1000,
      direction: "Decrease",
      compareAt: true,
      automatic: true,
      included: [],
      excluded: [],
    };
    expect(validEditorDraft(catalog)).toBe(true);
    expect(validEditorDraft({ ...catalog, adjustment: 10001 })).toBe(false);
    expect(validEditorDraft({ ...catalog, adjustment: 10.5 })).toBe(false);
    expect(
      validEditorDraft({ ...catalog, included: ["one"], excluded: ["one"] }),
    ).toBe(false);
    expect(
      validEditorDraft({ ...catalog, marketIds: ["bulgaria", "bulgaria"] }),
    ).toBe(false);
  });
  it("rejects reversed rollout date/time boundaries", () => {
    const rollout = {
      kind: "Rollout",
      rolloutType: "Event",
      start: "2026-10-05",
      startTime: "12:30",
      end: "2026-10-05",
      endTime: "12:31",
      notes: "",
      allocation: 100,
    };
    expect(validEditorDraft(rollout)).toBe(true);
    expect(validEditorDraft({ ...rollout, endTime: "12:29" })).toBe(false);
    expect(validEditorDraft({ ...rollout, allocation: 101 })).toBe(false);
    expect(validEditorDraft({ ...rollout, rolloutType: "Publish now" })).toBe(
      false,
    );
  });
  it("rejects invented historical snapshot metrics and arbitrary report input", () => {
    const report = {
      kind: "Report",
      metrics: ["orders", "sales"],
      start: "",
      end: "",
      dimension: "Date",
      visualization: "Line",
    };
    expect(validEditorDraft(report)).toBe(true);
    expect(validEditorDraft({ ...report, metrics: ["customers"] })).toBe(false);
    expect(validEditorDraft({ ...report, metrics: ["sessions"] })).toBe(false);
    expect(validEditorDraft({ ...report, metrics: ["orders", "orders"] })).toBe(
      false,
    );
    expect(
      validEditorDraft({ ...report, start: "2026-10-06", end: "2026-10-05" }),
    ).toBe(false);
  });
});

describe("actual local exploration values", () => {
  const order = (
    id: string,
    payment: Order["payment"],
    kind: Order["kind"] = "Order",
    fulfillment: Order["fulfillment"] = "Unfulfilled",
  ): Order => ({
    id,
    kind,
    payment,
    fulfillment,
    date: "2026-10-05",
    customerId: "",
    notes: "",
    tracking: "",
    refunded: 200,
    shipping: 100,
    lines: [{ productId: "one", quantity: 1, price: 1000 }],
  });
  it("excludes drafts/cancellations and preserves requested metric order", () => {
    const store = emptyStore();
    store.orders = [
      order("paid", "Paid"),
      order("pending", "Pending"),
      order("draft", "Paid", "Draft"),
      order("cancelled", "Paid", "Order", "Cancelled"),
    ];
    expect(
      localExplorationRows(store, ["sales", "orders"], "", "", "None")[0]
        .values,
    ).toEqual([900, 2]);
    expect(
      localExplorationRows(store, ["orders"], "2026-10-06", "", "Date"),
    ).toEqual([]);
  });
  it("preserves immutable sold lines when products are archived or missing", () => {
    const store = emptyStore();
    store.products = [
      {
        ...blankProduct("one"),
        title: "Archived",
        status: "Archived",
        quantity: 5,
      },
    ];
    store.orders = [
      {
        ...order("paid", "Paid"),
        lines: [
          { productId: "one", quantity: 1, price: 1000 },
          { productId: "missing", quantity: 2, price: 250 },
        ],
      },
    ];
    const rows = localExplorationRows(store, ["sales"], "", "", "Product");
    expect(rows.map((row) => row.values[0])).toEqual([1000, 500]);
    expect(
      localExplorationRows(store, ["inventory"], "", "", "None")[0].values,
    ).toEqual([0]);
  });
});

describe("local editor drafts", () => {
  it("round trips only the matching preview draft kind", () => {
    const state = initialPreviewState(true);
    state.stores.studio.entries.push({
      id: "menu-test",
      title: "Review",
      body: "",
      type: "MenuDraft",
      status: "Draft",
      tags: "",
      editorDraft: {
        kind: "Menu",
        handle: "review",
        items: [{ id: "one", label: "Products", url: "/products" }],
      },
    });
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
    state.stores.studio.entries[state.stores.studio.entries.length - 1].type =
      "BlogDraft";
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
  it.each([
    "javascript:alert(1)",
    "//example.com/path",
    "https://user:password@example.com",
    "/\\example.com",
    "https://example.com/a b",
  ])("rejects unsafe menu links %s", (url) =>
    expect(validMenuLink(url)).toBe(false),
  );
  it("bounds menu items and rejects duplicate identifiers", () => {
    expect(
      validEditorDraft({
        kind: "Menu",
        handle: "main",
        items: [
          { id: "same", label: "A", url: "/a" },
          { id: "same", label: "B", url: "/b" },
        ],
      }),
    ).toBe(false);
  });
});

describe("local file references", () => {
  it("normalizes HTTP(S) references without importing their contents", () => {
    expect(normalizePreviewFileUrl("https://EXAMPLE.com/a?b=1#c")).toBe(
      "https://example.com/a?b=1#c",
    );
    expect(normalizePreviewFileUrl("http://example.com")).toBe(
      "http://example.com/",
    );
  });
  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,YQ==",
    "file:///C:/test.png",
    "ftp://example.com/a",
    "/relative.png",
    "https://user:password@example.com/",
    "https://example.com/a b",
    "https://example.com/\n",
    "https://example.com/" + "x".repeat(2048),
  ])("rejects an unsafe or ambiguous URL: %s", (url) =>
    expect(normalizePreviewFileUrl(url)).toBeNull(),
  );
  it("round trips only a canonical File reference with empty body", () => {
    const state = initialPreviewState(true);
    state.stores.studio.entries.push({
      id: "local-url",
      title: "Reference",
      type: "File",
      status: "Saved",
      body: "",
      url: "https://example.com/a",
      tags: "",
    });
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
  });
  it.each([
    { url: "https://user:secret@example.com/a" },
    { url: "https://EXAMPLE.com/a" },
    { type: "Page" },
    { body: "Downloaded image" },
  ])("rejects corrupt file reference facts %o", (change) => {
    const state = initialPreviewState(true);
    state.stores.studio.entries.push({
      id: "local-url",
      title: "Reference",
      type: "File",
      status: "Saved",
      body: "",
      url: "https://example.com/a",
      tags: "",
      ...change,
    });
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
});
describe("new optional preview facts", () => {
  it("preserves unit bases, origin, customer phone prefix and order tags", () => {
    const state = initialPreviewState(true);
    Object.assign(state.stores.studio.products[0], {
      unitAmount: "100",
      unitMeasure: "g",
      unitBaseAmount: "1",
      unitBaseMeasure: "kg",
      countryOfOrigin: "BG",
      hsCode: "610910",
    });
    state.stores.studio.customers[0].phoneCountry = "GB";
    state.stores.studio.orders[0].tags = "Local review";
    expect(readPreviewState(JSON.stringify(state))).toEqual(state);
  });
  it.each([
    { unitBaseAmount: "1e2" },
    { unitBaseAmount: "-1" },
    { countryOfOrigin: "UNKNOWN" },
    { hsCode: "ABC" },
    { hsCode: "12345678901" },
  ])("rejects invalid optional product facts %o", (change) => {
    const state = initialPreviewState(true);
    Object.assign(state.stores.studio.products[0], change);
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
  it("keeps a phone prefix independent from the saved address", () => {
    const state = initialPreviewState(true);
    const customer = state.stores.studio.customers[0];
    customer.country = "Bulgaria";
    customer.phoneCountry = "GB";
    const restored = readPreviewState(JSON.stringify(state));
    expect(restored?.stores.studio.customers[0].country).toBe("Bulgaria");
    expect(restored?.stores.studio.customers[0].phoneCountry).toBe("GB");
    Object.assign(customer, { phoneCountry: "XX" });
    expect(readPreviewState(JSON.stringify(state))).toBeNull();
  });
});
describe("finite segment filters and preview guards", () => {
  it("does not treat unknown or empty filters as every customer", () => {
    const store = initialPreviewState(true).stores.studio;
    expect(customerMatchesSegment(store, store.customers[0], "")).toBe(false);
    expect(
      customerMatchesSegment(store, store.customers[0], "untrusted-filter"),
    ).toBe(false);
  });
  it("excludes cancelled orders and drafts from returning-customer evidence", () => {
    const store = initialPreviewState(true).stores.studio;
    const customer = store.customers[0];
    const base = store.orders[0];
    expect(
      customerMatchesSegment(
        {
          orders: [
            { ...base, id: "a", customerId: customer.id, kind: "Draft" },
            {
              ...base,
              id: "b",
              customerId: customer.id,
              kind: "Order",
              fulfillment: "Cancelled",
            },
          ],
        },
        customer,
        "Returning customers",
      ),
    ).toBe(false);
  });
  it("keeps new navigation behind the existing local preview gate", () => {
    expect(parsePreviewRoute(["agentic"])).toEqual({ section: "agentic" });
    expect(parsePreviewRoute(["store", "preferences"])).toEqual({
      section: "store",
      detail: "preferences",
    });
    expect(
      adminPreviewEnabled({
        SHOP_REFERENCE_PREVIEW: "1",
        NODE_ENV: "production",
      }),
    ).toBe(false);
    expect(
      adminPreviewEnabled({ SHOP_REFERENCE_PREVIEW: "1", VERCEL: "1" }),
    ).toBe(false);
  });
});
