import { describe, expect, it } from "vitest";
import {
  readDiscoveryInput,
  switchDiscoveryScope,
  discoverySearchParams,
  parseDiscoveryPrice,
  DISCOVERY_LIMITS,
} from "./discovery-input";
import {
  getCategory,
  validateCategoryAttributeValue,
} from "@treido/contracts/categories";

describe("canonical public discovery input", () => {
  it("normalizes invalid/missing scope to mixed supply without selecting an operating seller", () => {
    const source = new URLSearchParams(
      "seller=owner&sellerId=private-business&role=admin&condition=good",
    );
    const parsed = readDiscoveryInput(source);
    expect(parsed.input.seller).toBe("all");
    expect(parsed.input.condition).toBe("good");
    expect(parsed.input).not.toHaveProperty("sellerId");
    expect(parsed.canonical).not.toContain("private-business");
    expect(parsed.adjusted).toEqual(["role", "seller", "sellerId"]);
    expect(source.get("role")).toBe("admin");
  });
  it.each(["all", "personal", "business"] as const)(
    "preserves independent new and used conditions in %s supply",
    (seller) => {
      for (const condition of ["new", "good", "refurbished"])
        expect(readDiscoveryInput({ seller, condition }).input).toMatchObject({
          seller,
          condition,
        });
    },
  );
  it("switches only scope, drops the cursor and preserves canonical filters and Bulgarian query", () => {
    const parsed = readDiscoveryInput({
      q: " Телефон\n Pixel 9 ",
      category: "cat:electronics/phones",
      seller: "personal",
      condition: "good",
      location: "София",
      minPrice: "12,50",
      maxPrice: "100",
      currency: "EUR",
      sort: "price_asc",
      lang: "en",
      "attr.storageGB": "256",
      cursor: `opaque.${"a".repeat(43)}`,
    });
    const switched = switchDiscoveryScope(parsed.canonical, "business");
    expect(switched.has("cursor")).toBe(false);
    expect(readDiscoveryInput(switched).input).toEqual({
      ...parsed.input,
      seller: "business",
    });
    expect(
      readDiscoveryInput(switchDiscoveryScope(switched, "all")).input.q,
    ).toBe("Телефон Pixel 9");
  });
  it("equivalent parameter order/defaults/numeric spellings produce the same share URL", () => {
    const first = readDiscoveryInput(
      "sort=relevance&seller=all&q=Pixel&category=cat:electronics/phones&minPrice=00012.5&attr.storageGB=0256",
    );
    const second = readDiscoveryInput(
      "attr.storageGB=256&minPrice=12.50&category=cat:electronics/phones&q=Pixel",
    );
    expect(first.canonical).toBe(second.canonical);
    expect(readDiscoveryInput(first.canonical).input).toEqual(first.input);
    expect(first.canonical).not.toContain("seller=");
  });
  it.each([
    ["0", 0],
    ["0.01", 1],
    ["19.99", 1999],
    ["19,99", 1999],
    ["10000000", 1_000_000_000],
    ["0.1", 10],
  ] as const)("parses EUR %s exactly to %s minor units", (raw, minor) =>
    expect(parseDiscoveryPrice(raw)).toBe(minor),
  );
  it("rejects negative, fractional-cent, exponent, symbols, overflow and foreign-currency money", () => {
    for (const value of [
      "-1",
      "1.001",
      "1e3",
      "€10",
      "$10",
      "Infinity",
      "10000000.01",
      "9007199254740991",
      "12 345",
    ])
      expect(parseDiscoveryPrice(value)).toBeNull();
    expect(
      readDiscoveryInput("currency=USD&minPrice=10&maxPrice=20").input,
    ).toMatchObject({
      currency: "EUR",
      minPriceMinor: null,
      maxPriceMinor: null,
    });
  });
  it("orders a reversed valid price range and retains zero as a hard bound", () => {
    expect(readDiscoveryInput("minPrice=20&maxPrice=0").input).toMatchObject({
      minPriceMinor: 0,
      maxPriceMinor: 2000,
    });
    expect(readDiscoveryInput("minPrice=0").canonical).toContain(
      "minPrice=0.00",
    );
  });
  it("bounds Unicode query/location, removes controls and normalizes NFC without lowercasing display copy", () => {
    const parsed = readDiscoveryInput({
      q: `  Pixel\u0000\n${"😀".repeat(130)}`,
      location: "С".repeat(200),
    });
    expect(Array.from(parsed.input.q)).toHaveLength(DISCOVERY_LIMITS.query);
    expect(parsed.input.q).toMatch(/^Pixel /);
    expect(parsed.input.q).not.toContain("\u0000");
    expect(parsed.input.location).toHaveLength(DISCOVERY_LIMITS.location);
    expect(readDiscoveryInput({ q: "Cafe\u0301" }).input.q).toBe("Café");
    expect(readDiscoveryInput(parsed.canonical).input).toEqual(parsed.input);
  });
  it("accepts known roots/leaves without granting disabled leaves publication eligibility", () => {
    expect(readDiscoveryInput("category=cat:electronics").input.category).toBe(
      "cat:electronics",
    );
    expect(
      readDiscoveryInput("category=cat:electronics/phones").input.category,
    ).toBe("cat:electronics/phones");
    expect(getCategory("cat:electronics/phones")).toMatchObject({
      policy: { enabledForPublish: false },
    });
    expect(readDiscoveryInput("category=phones").input.category).toBeNull();
    expect(
      readDiscoveryInput(
        "category=unsafe-invented-leaf&sort=DROP+TABLE&lang=xx",
      ).input,
    ).toMatchObject({ category: null, sort: "relevance", locale: "bg" });
  });
  it("uses only leaf-owned typed attributes and canonical numeric/boolean values", () => {
    const parsed = readDiscoveryInput({
      category: "cat:electronics/phones",
      "attr.storageGB": "0256",
      "attr.carrierLocked": "true",
      "attr.brand": "  Samsung  ",
      "attr.other": "unsafe",
      "attr.ramGB": "1e3",
    });
    expect(parsed.input.attributes).toEqual({
      brand: "Samsung",
      carrierLocked: true,
      storageGB: 256,
    });
    expect(parsed.adjusted).toEqual(["attr.other", "attr.ramGB"]);
    // A search criterion doesn't require publishing's locked-carrier declaration.
    expect(
      validateCategoryAttributeValue(
        "cat:electronics/phones",
        "carrierLocked",
        true,
      ).ok,
    ).toBe(true);
    expect(
      readDiscoveryInput("category=cat:electronics&attr.storageGB=256").input
        .attributes,
    ).toEqual({});
  });
  it("bounds and canonicalizes multi-choice, decimal units and dimensions", () => {
    const choices = readDiscoveryInput(
      "category=cat:electronics/cameras-lenses&attr.includedAccessories=case&attr.includedAccessories=charger&attr.includedAccessories=case",
    );
    expect(choices.input.attributes.includedAccessories).toEqual([
      "case",
      "charger",
    ]);
    expect(readDiscoveryInput(choices.canonical).input).toEqual(choices.input);
    const size = readDiscoveryInput({
      category: "cat:home/living-room-furniture",
      "attr.weight": '{"unit":"kg","value":"12.00"}',
      "attr.dimensions": '{"unit":"cm","depth":40,"height":90,"width":80}',
    });
    expect(size.input.attributes.weight).toEqual({ value: "12", unit: "kg" });
    expect(size.input.attributes.dimensions).toEqual({
      width: 80,
      height: 90,
      depth: 40,
      unit: "cm",
    });
    expect(readDiscoveryInput(size.canonical).input).toEqual(size.input);
    expect(
      readDiscoveryInput({
        category: "cat:home/living-room-furniture",
        "attr.weight": '{"unit":"lb","value":"12"}',
        "attr.dimensions": '{"unit":"m","depth":100000,"height":90,"width":80}',
      }).input.attributes,
    ).toEqual({});
  });
  it("caps URL pairs, records ignored shipping/radius and strips malformed or oversized cursors", () => {
    const query = new URLSearchParams();
    for (let i = 0; i < 70; i++) query.append(`unknown${i}`, "value");
    query.set("q", "beyond cap");
    expect(readDiscoveryInput(query.toString()).input.q).toBe("");
    expect(
      readDiscoveryInput("radius=10&shipping=nationwide&cursor=plain").adjusted,
    ).toEqual(["cursor", "radius", "shipping"]);
    expect(
      readDiscoveryInput({ cursor: `x.${"a".repeat(900)}` }).cursor,
    ).toBeNull();
  });
  it("uses first scalar duplicate consistently and never mutates the input params", () => {
    const source = new URLSearchParams(
      "q=first&q=second&seller=personal&seller=business&category=cat:electronics/phones&attr.storageGB=128&attr.storageGB=256",
    );
    const before = source.toString();
    const parsed = readDiscoveryInput(source);
    expect(parsed.input).toMatchObject({
      q: "first",
      seller: "personal",
      attributes: { storageGB: 128 },
    });
    expect(parsed.adjusted).toEqual(["attr.storageGB", "q", "seller"]);
    expect(source.toString()).toBe(before);
  });
  it("serializes a normalized input independently of its pagination token", () => {
    const { input } = readDiscoveryInput(
      "q=Pixel&lang=en&seller=business&condition=good",
    );
    expect(discoverySearchParams(input).has("cursor")).toBe(false);
    expect(
      discoverySearchParams(input, `opaque.${"a".repeat(43)}`).get("cursor"),
    ).toMatch(/^opaque\./);
  });
});
