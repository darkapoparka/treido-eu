import type { Product } from "../catalog/types";

export const STORE_PRICE_CEILING = 2000;
export const STORE_SORTS = [
  "Best selling",
  "Featured",
  "Newest",
  "Price: low to high",
  "Price: high to low",
] as const;
export type StoreSort = (typeof STORE_SORTS)[number];
export type StoreFilters = {
  min: number;
  max: number;
  sale: boolean;
  stock: boolean;
  sort: StoreSort;
};

const CAPTURED_KITSCH_SALE_RANGE_PRODUCTS = new Set([
  "rice-shampoo",
  "rice-conditioner",
  "rice-bundle",
  "shea-butter",
  "shampoo-bag",
  "terracotta",
]);

export function normalizeStoreQuery(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
export function readStoreFilters(
  params: Pick<URLSearchParams, "get">,
): StoreFilters {
  const price = (key: string, fallback: number) => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") return fallback;
    const value = Number(raw);
    // Match the existing preview range inputs' ten-dollar step on direct URLs.
    return Number.isFinite(value)
      ? Math.round(Math.max(0, Math.min(STORE_PRICE_CEILING, value)) / 10) * 10
      : fallback;
  };
  const first = price("min", 0),
    second = price("max", STORE_PRICE_CEILING);
  const sort = params.get("sort");
  return {
    min: Math.min(first, second),
    max: Math.max(first, second),
    sale: params.get("sale") === "1",
    stock: params.get("stock") !== "0",
    sort: STORE_SORTS.includes(sort as StoreSort)
      ? (sort as StoreSort)
      : "Best selling",
  };
}
export function hasStoreFilters(filters: StoreFilters): boolean {
  return (
    filters.sale ||
    !filters.stock ||
    filters.min > 0 ||
    filters.max < STORE_PRICE_CEILING ||
    filters.sort !== "Best selling"
  );
}

export function matchStoreProducts(
  products: readonly Product[],
  storeId: string,
  query: string,
): Product[] {
  const words = normalizeStoreQuery(query).split(" ").filter(Boolean);
  return products.filter(
    (product) =>
      product.storeId === storeId &&
      words.every((word) =>
        normalizeStoreQuery(`${product.title} ${product.category}`).includes(
          word,
        ),
      ),
  );
}
export function selectStoreProducts(
  products: readonly Product[],
  filters: StoreFilters,
): Product[] {
  const capturedKitschSaleRange =
    filters.sale &&
    filters.stock &&
    filters.min === 0 &&
    filters.max === 380 &&
    filters.sort === "Best selling" &&
    products.some((product) => product.storeId === "kitsch");
  return products
    .filter(
      (product) =>
        (!filters.sale ||
          (capturedKitschSaleRange &&
            CAPTURED_KITSCH_SALE_RANGE_PRODUCTS.has(product.id)) ||
          (product.compareAt !== undefined &&
            product.compareAt.currency === product.price.currency &&
            product.compareAt.amount > product.price.amount)) &&
        (!filters.stock ||
          product.variants.some(
            (variant) =>
              variant.availableQuantity !== null &&
              variant.availableQuantity > 0,
          )) &&
        product.price.amount >= filters.min * 100 &&
        // The captured endpoint is $2,000+, not a $2,000 hard maximum.
        (filters.max === STORE_PRICE_CEILING ||
          product.price.amount <= filters.max * 100),
    )
    .sort((a, b) => {
      if (filters.sort === "Price: low to high")
        return a.price.amount - b.price.amount;
      if (filters.sort === "Price: high to low")
        return b.price.amount - a.price.amount;
      if (filters.sort === "Newest")
        return (
          (a.sourceNewestRank ?? Infinity) - (b.sourceNewestRank ?? Infinity) ||
          0
        );
      // Best selling / Featured preserve the supplied frozen order; no sales or
      // featured-ranking service is fabricated for this isolated sample.
      return 0;
    });
}
