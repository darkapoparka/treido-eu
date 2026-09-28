import { describe, expect, it } from "vitest";
import type { Product } from "../catalog/types";
import {
  hasStoreFilters,
  matchStoreProducts,
  normalizeStoreQuery,
  readStoreFilters,
  selectStoreProducts,
} from "./store-model";

const item = (id: string, overrides: Partial<Product> = {}): Product => ({
  id,
  title: `${id} shampoo`,
  storeId: "sample-store",
  category: "Hair care",
  images: [],
  price: { amount: 1600, currency: "USD" },
  ratingCount: "",
  description: "",
  saleUnit: "piece",
  variants: [{ id: `${id}-variant`, label: "Sample", availableQuantity: 5 }],
  ...overrides,
});
const parse = (query = "") => readStoreFilters(new URLSearchParams(query));
const ids = (products: Product[]) => products.map((product) => product.id);

describe("store reference search and filters", () => {
  it("uses the captured default selection", () => {
    expect(parse()).toEqual({
      min: 0,
      max: 2000,
      sale: false,
      stock: true,
      sort: "Best selling",
    });
    expect(hasStoreFilters(parse())).toBe(false);
  });
  it("recovers from non-finite and blank bounds and unknown sorting", () => {
    expect(parse("min=NaN&max=Infinity&sort=unexpected")).toEqual(parse());
    expect(parse("min=+&max=")).toEqual(parse());
  });
  it("keeps URL amounts on the same step as the range controls", () => {
    expect(parse("min=5&max=374")).toMatchObject({ min: 10, max: 370 });
  });
  it("clamps negative and excessive bounds", () => {
    expect(parse("min=-10&max=9000")).toEqual(parse());
  });
  it("orders reversed bounds and preserves an explicit zero maximum", () => {
    expect(parse("min=400&max=100")).toMatchObject({ min: 100, max: 400 });
    expect(parse("max=0").max).toBe(0);
  });
  it("detects only meaningful non-default criteria", () => {
    for (const query of [
      "min=10",
      "max=380",
      "sale=1",
      "stock=0",
      "sort=Newest",
    ])
      expect(hasStoreFilters(parse(query))).toBe(true);
    expect(hasStoreFilters(parse("q=shampoo&sale=0&stock=1"))).toBe(false);
  });
  it("treats $2,000+ as open ended", () => {
    expect(
      ids(
        selectStoreProducts(
          [item("high", { price: { amount: 250000, currency: "USD" } })],
          parse(),
        ),
      ),
    ).toEqual(["high"]);
  });
  it("applies finite price bounds inclusively in cents", () => {
    const products = [
      item("under", { price: { amount: 999, currency: "USD" } }),
      item("low", { price: { amount: 1000, currency: "USD" } }),
      item("high", { price: { amount: 2000, currency: "USD" } }),
      item("over", { price: { amount: 2001, currency: "USD" } }),
    ];
    expect(ids(selectStoreProducts(products, parse("min=10&max=20")))).toEqual([
      "low",
      "high",
    ]);
  });
  it("requires a real higher compare-at price in the same currency", () => {
    const products = [
      item("sale", { compareAt: { amount: 2000, currency: "USD" } }),
      item("equal", { compareAt: { amount: 1600, currency: "USD" } }),
      item("lower", { compareAt: { amount: 1000, currency: "USD" } }),
      item("other-currency", { compareAt: { amount: 2000, currency: "EUR" } }),
      item("regular"),
    ];
    expect(ids(selectStoreProducts(products, parse("sale=1")))).toEqual([
      "sale",
    ]);
  });
  it("uses actual variant availability and permits including unavailable items", () => {
    const products = [
      item("ready"),
      item("sold", {
        variants: [{ id: "sold-sku", label: "Sample", availableQuantity: 0 }],
      }),
      item("none", { variants: [] }),
    ];
    expect(ids(selectStoreProducts(products, parse()))).toEqual(["ready"]);
    expect(ids(selectStoreProducts(products, parse("stock=0")))).toEqual([
      "ready",
      "sold",
      "none",
    ]);
  });
  it("normalizes whitespace, case and full-width search input", () => {
    expect(
      normalizeStoreQuery(
        "  \uFF33\uFF28\uFF21\uFF2D\uFF30\uFF2F\uFF2F \n bar ",
      ),
    ).toBe("shampoo bar");
  });
  it("never mixes another merchant into suggestions or results", () => {
    expect(
      ids(
        matchStoreProducts(
          [item("mine"), item("foreign", { storeId: "other-store" })],
          "sample-store",
          "shampoo",
        ),
      ),
    ).toEqual(["mine"]);
  });
  it("requires every query word without inventing fallback results", () => {
    const products = [
      item("rice", { title: "Rice Shampoo Bar" }),
      item("liquid", { title: "Rice Shampoo Liquid" }),
    ];
    expect(
      ids(matchStoreProducts(products, "sample-store", " BAR rice ")),
    ).toEqual(["rice"]);
    expect(matchStoreProducts(products, "sample-store", "unknown")).toEqual([]);
    expect(matchStoreProducts([], "sample-store", "")).toEqual([]);
  });
  it("sorts prices with stable ties", () => {
    const products = [
      item("a"),
      item("b"),
      item("low", { price: { amount: 500, currency: "USD" } }),
    ];
    expect(
      ids(selectStoreProducts(products, parse("sort=Price%3A+low+to+high"))),
    ).toEqual(["low", "a", "b"]);
    expect(
      ids(selectStoreProducts(products, parse("sort=Price%3A+high+to+low"))),
    ).toEqual(["a", "b", "low"]);
  });
  it("uses recorded newness ranks without inventing dates", () => {
    const products = [
      item("unknown"),
      item("later", { sourceNewestRank: 2 }),
      item("first", { sourceNewestRank: 1 }),
      item("unknown-two"),
    ];
    expect(ids(selectStoreProducts(products, parse("sort=Newest")))).toEqual([
      "first",
      "later",
      "unknown",
      "unknown-two",
    ]);
  });
  it("preserves supplied order for featured or best selling", () => {
    const products = [item("b"), item("a")];
    expect(ids(selectStoreProducts(products, parse("sort=Featured")))).toEqual([
      "b",
      "a",
    ]);
    expect(ids(selectStoreProducts(products, parse()))).toEqual(["b", "a"]);
  });
  it("does not mutate caller records or arrays", () => {
    const products = Object.freeze([
      Object.freeze(item("b", { price: { amount: 2000, currency: "USD" } })),
      Object.freeze(item("a")),
    ]);
    const filtered = selectStoreProducts(
      products,
      parse("sort=Price%3A+low+to+high"),
    );
    expect(filtered[0]).toBe(products[1]);
    expect(products.map((product) => product.id)).toEqual(["b", "a"]);
  });
});
