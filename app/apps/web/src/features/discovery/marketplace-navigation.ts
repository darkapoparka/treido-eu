import {
  discoverySearchParams,
  readDiscoveryInput,
  type DiscoveryInput,
} from "../catalog/discovery-input";
export function marketplaceHref(
  path: string,
  input: DiscoveryInput,
  cursor: string | null = null,
) {
  const params = discoverySearchParams(input, cursor);
  params.set("lang", input.locale);
  return path + "?" + params.toString();
}
/** One result destination for departments, groups and leaves, with keyword
 * and filters retained. Unscoped queries keep the global Search route. */
export function marketplaceResultsHref(
  input: DiscoveryInput,
  cursor: string | null = null,
) {
  return marketplaceHref(
    input.category
      ? `/explore/${encodeURIComponent(input.category)}`
      : "/search",
    input,
    cursor,
  );
}
/** Resolve legacy internal result links before recording their owned return.
 * Explicit query/hash context is preserved; the server still validates it. */
export function canonicalResultsDestination(href: string) {
  if (!href.startsWith("/search?")) return href;
  const destination = new URL(href, "https://treido.invalid");
  const category = readDiscoveryInput(destination.searchParams).input.category;
  if (!category) return href;
  return `/explore/${encodeURIComponent(category)}${destination.search}${destination.hash}`;
}
export function withoutDiscoveryFilters(input: DiscoveryInput): DiscoveryInput {
  return {
    ...input,
    category: null,
    condition: null,
    location: "",
    minPriceMinor: null,
    maxPriceMinor: null,
    attributes: {},
  };
}
