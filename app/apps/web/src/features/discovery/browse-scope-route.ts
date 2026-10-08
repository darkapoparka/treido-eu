import {
  discoverySearchParams,
  readDiscoveryInput,
  switchDiscoveryScope,
  type BrowseScope,
} from "../catalog/discovery-input";
import { parseLocale } from "../locale/locale";

const discoveryPath = (path: string) =>
  path === "/" ||
  /^\/(search|explore|products|stores|assistant|minis)(\/|$)/.test(path);

/** Public URL context only. Private account, cart and order routes are excluded. */
export function discoveryDestination(href: string, source: URLSearchParams) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const destination = new URL(href, "https://treido.invalid");
  if (!discoveryPath(destination.pathname)) return href;
  const context = discoverySearchParams(readDiscoveryInput(source).input);
  // BG can no longer be implicit: a saved or browser preference may be English.
  const locale = parseLocale(source.get("lang"));
  if (locale) context.set("lang", locale);
  if (
    destination.searchParams.has("category") &&
    destination.searchParams.get("category") !== context.get("category")
  )
    for (const key of [...context.keys()])
      if (key.startsWith("attr.")) context.delete(key);
  // Pagination belongs to its result entry, never a different destination.
  for (const key of new Set(destination.searchParams.keys())) {
    context.delete(key);
    for (const item of destination.searchParams.getAll(key))
      context.append(key, item);
  }
  const query = context.toString();
  return `${destination.pathname}${query ? `?${query}` : ""}${destination.hash}`;
}

/** Dock destinations start Home/Explore afresh. Result/detail links retain
 * their complete browse context through discoveryDestination. */
export function discoveryDockDestination(
  href: string,
  source: URLSearchParams,
) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const destination = new URL(href, "https://treido.invalid");
  if (!["/", "/explore"].includes(destination.pathname))
    return discoveryDestination(href, source);
  const { input } = readDiscoveryInput(source);
  const params = new URLSearchParams(destination.search);
  if (input.seller !== "all") params.set("seller", input.seller);
  const locale = parseLocale(source.get("lang"));
  if (locale) params.set("lang", locale);
  return `${destination.pathname}${params.size ? `?${params}` : ""}${destination.hash}`;
}

export function browseScopeHref(
  pathname: string,
  source: URLSearchParams,
  scope: BrowseScope,
) {
  const params = switchDiscoveryScope(source, scope);
  const locale = parseLocale(source.get("lang"));
  if (locale) params.set("lang", locale);
  return `${pathname}${params.size ? `?${params}` : ""}`;
}

/** Keep the reference-only sheet separate while retaining canonical context. */
export function referenceSearchDestination(
  source: URLSearchParams,
  reference: URLSearchParams,
) {
  const params = new URLSearchParams(source);
  for (const key of [
    "q",
    "deals",
    "following",
    "color",
    "size",
    "gender",
    "price",
    "ratings",
    "country",
    "origin",
    "answer",
    "view",
    "edit",
    "cursor",
    "page",
    "sellerId",
  ])
    params.delete(key);
  const category = params.get("category");
  if (category && !category.startsWith("cat:") && !category.startsWith("nav:"))
    params.delete("category");
  if (
    params.has("sort") &&
    !["relevance", "newest", "price_asc", "price_desc"].includes(
      params.get("sort")!,
    )
  )
    params.delete("sort");
  // Canonical category/sort IDs are not replaced by empty legacy sheet defaults.
  for (const [key, value] of reference) params.set(key, value);
  return params;
}
