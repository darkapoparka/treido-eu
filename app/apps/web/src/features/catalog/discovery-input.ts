import {
  getBrowseCategory,
  itemConditions,
  validateCategoryAttributeValue,
  type BrowseCategoryId,
  type ItemCondition,
  type AttributeDefinition,
} from "@treido/contracts/categories";

export const DISCOVERY_LIMITS = {
  query: 120,
  location: 100,
  pairs: 64,
  attributes: 16,
  attributeValue: 512,
  priceMinor: 1_000_000_000,
  cursor: 768,
  pageSize: 24,
} as const;
export type BrowseScope = "all" | "personal" | "business";
export const discoverySorts = [
  "relevance",
  "newest",
  "price_asc",
  "price_desc",
] as const;
export type DiscoverySort = (typeof discoverySorts)[number];
export type DiscoveryAttribute =
  | string
  | number
  | boolean
  | string[]
  | { value: string; unit: string }
  | { width: number; height: number; depth: number; unit: "mm" | "cm" | "m" };
export type DiscoveryInput = Readonly<{
  q: string;
  category: BrowseCategoryId | null;
  seller: BrowseScope;
  condition: ItemCondition | null;
  location: string;
  minPriceMinor: number | null;
  maxPriceMinor: number | null;
  currency: "EUR";
  sort: DiscoverySort;
  locale: "bg" | "en";
  attributes: Readonly<Record<string, DiscoveryAttribute>>;
}>;
export type DiscoveryParams =
  | string
  | URLSearchParams
  | Readonly<Record<string, string | readonly string[] | undefined>>;
const known = new Set([
  "q",
  "category",
  "seller",
  "condition",
  "location",
  "minPrice",
  "maxPrice",
  "currency",
  "sort",
  "lang",
  "cursor",
]);
const clean = (value: string) =>
  value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\ufeff]/g, " ")
    .trim()
    .replace(/\s+/gu, " ");
const bound = (value: string, length: number) =>
  Array.from(clean(value)).slice(0, length).join("");
export const normalizeBrowseScope = (value: unknown): BrowseScope =>
  value === "personal" || value === "business" ? value : "all";
export function parseDiscoveryPrice(value: string | null): number | null {
  if (value === null || !/^\d{1,8}(?:[.,]\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replace(",", ".").split(".");
  const minor = Number(whole + fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor <= DISCOVERY_LIMITS.priceMinor
    ? minor
    : null;
}
function paramsFrom(source: DiscoveryParams) {
  if (typeof source === "string")
    source = new URLSearchParams(source.slice(0, 8192));
  const params = new URLSearchParams();
  let pairs = 0;
  const entries =
    source instanceof URLSearchParams
      ? source.entries()
      : Object.entries(source);
  for (const [key, raw] of entries) {
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (++pairs > DISCOVERY_LIMITS.pairs) return params;
      if (typeof value === "string") params.append(key, value.slice(0, 1024));
    }
  }
  return params;
}
function attributeValue(
  definition: AttributeDefinition,
  values: string[],
): unknown {
  if (
    !values.length ||
    values.some((value) => value.length > DISCOVERY_LIMITS.attributeValue)
  )
    return undefined;
  const raw = clean(values[0]);
  switch (definition.type) {
    case "multi_enum":
      return [...new Set(values.map(clean))].sort();
    case "boolean":
      return raw === "true" ? true : raw === "false" ? false : undefined;
    case "integer":
      return /^\d{1,12}$/.test(raw) ? Number(raw) : undefined;
    case "decimal":
    case "dimension": {
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    default:
      return raw;
  }
}
function normalizedAttribute(value: unknown): DiscoveryAttribute {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if ("value" in record)
      return {
        value: String(record.value)
          .replace(/(\.\d*?)0+$/, "$1")
          .replace(/\.$/, ""),
        unit: String(record.unit),
      };
    return {
      width: Number(record.width),
      height: Number(record.height),
      depth: Number(record.depth),
      unit: record.unit as "mm" | "cm" | "m",
    };
  }
  return value as DiscoveryAttribute;
}

/** Public query data only. Operating seller IDs, roles and preferences are ignored. */
export function readDiscoveryInput(source: DiscoveryParams) {
  const params = paramsFrom(source),
    adjusted = new Set<string>();
  const first = (name: string) => {
    if (params.getAll(name).length > 1) adjusted.add(name);
    return params.get(name);
  };
  const category = getBrowseCategory(first("category") ?? "");
  if (params.has("category") && !category) adjusted.add("category");
  const rawCondition = first("condition");
  const condition =
    itemConditions.find((value) => value === rawCondition) ?? null;
  if (rawCondition && !condition) adjusted.add("condition");
  const currency = first("currency");
  const validCurrency = !currency || currency === "EUR";
  if (!validCurrency) adjusted.add("currency");
  const rawMinimum = first("minPrice"),
    rawMaximum = first("maxPrice");
  let minPriceMinor = validCurrency ? parseDiscoveryPrice(rawMinimum) : null;
  let maxPriceMinor = validCurrency ? parseDiscoveryPrice(rawMaximum) : null;
  if (rawMinimum !== null && minPriceMinor === null) adjusted.add("minPrice");
  if (rawMaximum !== null && maxPriceMinor === null) adjusted.add("maxPrice");
  if (
    minPriceMinor !== null &&
    maxPriceMinor !== null &&
    minPriceMinor > maxPriceMinor
  ) {
    [minPriceMinor, maxPriceMinor] = [maxPriceMinor, minPriceMinor];
    adjusted.add("priceRange");
  }
  const rawSort = first("sort"),
    rawLocale = first("lang"),
    rawScope = first("seller");
  const sort = discoverySorts.find((value) => value === rawSort) ?? "relevance";
  if (rawSort && sort !== rawSort) adjusted.add("sort");
  const seller = normalizeBrowseScope(rawScope);
  if (rawScope && seller !== rawScope) adjusted.add("seller");
  if (rawLocale && !["bg", "en"].includes(rawLocale)) adjusted.add("lang");
  const attributes: Record<string, DiscoveryAttribute> = {};
  if (category?.kind === "leaf") {
    for (const definition of [...category.profile.fields].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const key = `attr.${definition.id}`;
      const values = params.getAll(key);
      if (!values.length) continue;
      if (definition.type !== "multi_enum" && values.length > 1)
        adjusted.add(key);
      const value = attributeValue(definition, values);
      const parsed = validateCategoryAttributeValue(
        category.id,
        definition.id,
        value,
      );
      if (
        !parsed.ok ||
        Object.keys(attributes).length >= DISCOVERY_LIMITS.attributes
      ) {
        adjusted.add(key);
        continue;
      }
      attributes[definition.id] = normalizedAttribute(
        parsed.attributes[definition.id],
      );
    }
  }
  for (const key of params.keys())
    if (
      !known.has(key) &&
      (!key.startsWith("attr.") || !Object.hasOwn(attributes, key.slice(5)))
    )
      adjusted.add(key);
  const rawQuery = first("q") ?? "",
    rawLocation = first("location") ?? "";
  const q = bound(rawQuery, DISCOVERY_LIMITS.query),
    location = bound(rawLocation, DISCOVERY_LIMITS.location);
  if (q !== rawQuery) adjusted.add("q");
  if (location !== rawLocation) adjusted.add("location");
  const input: DiscoveryInput = {
    q,
    category: category?.id ?? null,
    seller,
    condition,
    location,
    minPriceMinor,
    maxPriceMinor,
    currency: "EUR",
    sort,
    locale: rawLocale === "en" ? "en" : "bg",
    attributes,
  };
  const cursor = first("cursor");
  const boundedCursor =
    cursor &&
    cursor.length <= DISCOVERY_LIMITS.cursor &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cursor)
      ? cursor
      : null;
  if (cursor && !boundedCursor) adjusted.add("cursor");
  return {
    input,
    cursor: boundedCursor,
    adjusted: [...adjusted].sort(),
    canonical: discoverySearchParams(input, boundedCursor).toString(),
  };
}
export function discoverySearchParams(
  input: DiscoveryInput,
  cursor: string | null = null,
): URLSearchParams {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.category) params.set("category", input.category);
  if (input.seller !== "all") params.set("seller", input.seller);
  if (input.condition) params.set("condition", input.condition);
  if (input.location) params.set("location", input.location);
  const price = (minor: number) =>
    `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
  if (input.minPriceMinor !== null)
    params.set("minPrice", price(input.minPriceMinor));
  if (input.maxPriceMinor !== null)
    params.set("maxPrice", price(input.maxPriceMinor));
  if (input.minPriceMinor !== null || input.maxPriceMinor !== null)
    params.set("currency", input.currency);
  if (input.sort !== "relevance") params.set("sort", input.sort);
  if (input.locale !== "bg") params.set("lang", input.locale);
  for (const key of Object.keys(input.attributes).sort()) {
    const value = input.attributes[key];
    if (Array.isArray(value))
      for (const choice of [...value].sort())
        params.append(`attr.${key}`, choice);
    else
      params.set(
        `attr.${key}`,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
  }
  if (cursor) params.set("cursor", cursor);
  return params;
}
export function switchDiscoveryScope(
  source: DiscoveryParams,
  scope: BrowseScope,
) {
  const { input } = readDiscoveryInput(source);
  return discoverySearchParams({
    ...input,
    seller: normalizeBrowseScope(scope),
  });
}
