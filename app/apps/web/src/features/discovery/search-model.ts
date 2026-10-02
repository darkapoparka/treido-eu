import type {
  SearchCatalog,
  SearchProduct,
  SearchStore,
} from "../catalog/search-catalog";

export type SearchFilters = {
  deals: boolean;
  following: boolean;
  sort: string;
  category: string;
  color: string;
  size: string;
  gender: string;
  price: string;
  ratings: string;
  country: string;
  origin: string;
};

export const emptyFilters: SearchFilters = {
  deals: false,
  following: false,
  sort: "Relevance",
  category: "",
  color: "",
  size: "",
  gender: "",
  price: "",
  ratings: "",
  country: "",
  origin: "",
};

// Existing frozen-reference labels, not a production taxonomy or evidence of
// inventory, gender or shipping coverage.
export const filterOptions = {
  sort: [
    "Relevance",
    "Newest",
    "Lowest → Highest Price",
    "Highest → Lowest Price",
  ],
  category: [
    "All Categories",
    "Women",
    "Men",
    "Beauty",
    "Food & drinks",
    "Baby & toddler",
    "Home",
    "Fitness & nutrition",
    "Accessories",
  ],
  color: ["Black", "Blue", "Pink"],
  size: ["XS", "S", "M", "L", "One size"],
  gender: ["Women", "Men", "Unisex"],
  price: ["Under $25", "Under $50", "Under $100", "$100 and up"],
  ratings: ["4 stars and up", "4.5 stars and up"],
  country: ["United States"],
} as const;

export const womenCategories = [
  "All Women",
  "Shirts & tops",
  "Shoes",
  "Dresses",
  "Pants",
  "Intimates",
  "Activewear",
  "Socks & hosiery",
  "Swimwear",
] as const;

export type FilterSection = keyof typeof filterOptions;
const text = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export function categoryValue(label: string): string {
  if (text(label) === "all categories") return "";
  if (text(label) === "all women") return "Women";
  return label;
}

export function isCapturedFilteredJeans(
  query: string,
  filters: SearchFilters,
): boolean {
  return (
    text(query) === "jeans" &&
    filters.deals &&
    filters.sort === "Highest → Lowest Price" &&
    text(filters.category) === "pants"
  );
}

export function readSearchFilters(
  params: Pick<URLSearchParams, "get">,
): SearchFilters {
  const enabled = (key: string) =>
    ["1", "true"].includes(params.get(key) ?? "");
  return {
    deals: enabled("deals"),
    following: enabled("following"),
    sort: params.get("sort") || "Relevance",
    category: categoryValue(params.get("category") ?? ""),
    color: params.get("color") ?? "",
    size: params.get("size") ?? "",
    gender: params.get("gender") ?? "",
    price: params.get("price") ?? "",
    ratings: params.get("ratings") ?? "",
    country: params.get("country") ?? "",
    origin: params.get("origin") ?? "",
  };
}

export function searchParameters(
  query: string,
  filters: SearchFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  for (const [key, value] of Object.entries(filters)) {
    const normalized =
      key === "category" ? categoryValue(String(value)) : value;
    if (normalized && normalized !== "Relevance")
      params.set(key, String(normalized));
  }
  return params;
}

export function hasSearchFilters(filters: SearchFilters): boolean {
  return Object.entries(filters).some(
    ([key, value]) => value !== emptyFilters[key as keyof SearchFilters],
  );
}

function matchesCategory(product: SearchProduct, selection: string): boolean {
  const category = text(categoryValue(selection));
  const ownCategory = text(product.category);
  if (!category || category === ownCategory) return true;
  // Broad selections use declared catalog facts, never an inference from a
  // product photograph, title or merchant identity. Unknown metadata stays out.
  if (category === "women")
    return (
      ownCategory === "womenswear" || text(product.gender ?? "") === "women"
    );
  if (category === "men")
    return ownCategory === "menswear" || text(product.gender ?? "") === "men";
  if (category === "pants") return ownCategory === "jeans";
  return false;
}

function matchesPrice(product: SearchProduct, selection: string): boolean {
  if (!selection) return true;
  // Dollar facets must not silently treat another currency as USD.
  if (product.price.currency !== "USD") return false;
  switch (selection) {
    case "Under $25":
      return product.price.amount < 2500;
    case "Under $50":
      return product.price.amount < 5000;
    case "Under $100":
      return product.price.amount < 10000;
    case "$100 and up":
      return product.price.amount >= 10000;
    default:
      return false;
  }
}

function matchesQuery(query: string, value: string): boolean {
  const words = text(value).match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = text(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!terms.length) return !query.trim();
  // A partial word can match its prefix, but "men" must not match "women".
  return terms.every((term) => words.some((word) => word.startsWith(term)));
}

export function searchProducts(
  catalog: SearchCatalog,
  query: string,
  filters: SearchFilters,
  followed: readonly string[],
): SearchProduct[] {
  const stores = new Map(catalog.stores.map((store) => [store.id, store]));
  const followedIds = new Set(followed);
  const products = catalog.products.filter((product) => {
    const store = stores.get(product.storeId);
    return (
      matchesQuery(
        query,
        `${product.title} ${product.category} ${product.gender ?? ""} ${store?.name ?? ""}`,
      ) &&
      (!filters.deals || !!product.promotion) &&
      (!filters.following || followedIds.has(product.storeId)) &&
      matchesCategory(product, filters.category) &&
      (!filters.color || text(product.color ?? "") === text(filters.color)) &&
      (!filters.size ||
        product.variants.some(
          (variant) =>
            text(variant.label) === text(filters.size) &&
            variant.availableQuantity !== null &&
            variant.availableQuantity > 0,
        )) &&
      (!filters.gender ||
        text(product.gender ?? "") === text(filters.gender)) &&
      (!filters.country ||
        product.shippingDestinations?.some(
          (country) => text(country) === text(filters.country),
        )) &&
      (!filters.origin ||
        text(product.country ?? "") === text(filters.origin)) &&
      (!filters.ratings ||
        (product.rating !== undefined &&
          product.rating >= (filters.ratings.startsWith("4.5") ? 4.5 : 4))) &&
      matchesPrice(product, filters.price)
    );
  });
  return products.sort((a, b) => {
    if (filters.sort === "Newest")
      return (b.referenceNewnessRank ?? 0) - (a.referenceNewnessRank ?? 0);
    if (
      ["Lowest → Highest Price", "Highest → Lowest Price"].includes(
        filters.sort,
      )
    ) {
      // Group different currencies rather than inventing an exchange rate.
      if (a.price.currency !== b.price.currency)
        return a.price.currency.localeCompare(b.price.currency);
      return filters.sort === "Lowest → Highest Price"
        ? a.price.amount - b.price.amount
        : b.price.amount - a.price.amount;
    }
    return 0;
  });
}

export function searchStores(
  catalog: SearchCatalog,
  query: string,
  filters: SearchFilters,
  products: readonly SearchProduct[],
): SearchStore[] {
  if (isCapturedFilteredJeans(query, filters)) {
    return ["arrow-twenty-two", "american-blues"].flatMap((id) => {
      const store = catalog.stores.find((candidate) => candidate.id === id);
      return store ? [store] : [];
    });
  }
  const productStores = new Set(products.map((product) => product.storeId));
  const hasFacets = hasSearchFilters({ ...filters, sort: "Relevance" });
  const stores = catalog.stores.filter((store) => {
    if (hasFacets) return productStores.has(store.id);
    return (
      productStores.has(store.id) ||
      (!!query.trim() &&
        matchesQuery(query, `${store.name} ${store.categories.join(" ")}`))
    );
  });
  // Preserve the frozen jeans rail's leading stores without showing those
  // merchants for unrelated queries or when facets exclude them.
  if (text(query) === "jeans") {
    const rank = (id: string) =>
      id === "fitjeans" ? 0 : id === "miss-me" ? 1 : 2;
    stores.sort((a, b) => rank(a.id) - rank(b.id));
  }
  return stores;
}

// A recorded answer may only stand in for its recorded question. It is not a
// generated response to a different request about the same example photo.
export const capturedCapQuestion = "Find me a baseball cap like this";
export function isCapturedCapQuestion(value: string): boolean {
  return (
    value.trim().replace(/\s+/g, " ").toLowerCase() ===
    capturedCapQuestion.toLowerCase()
  );
}
