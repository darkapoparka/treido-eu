import type { BuyerPublicView } from "../catalog/buyer-entry-model";
import type { SearchCatalog } from "../catalog/search-catalog";
import {
  discoverySearchParams,
  readDiscoveryInput,
  type DiscoveryInput,
} from "../catalog/discovery-input";

/** Search's bounded card/identity projection, not a reference Catalog or an
 * inventory snapshot. Server ranking and pagination remain authoritative. */
export function publicSearchCatalog(view: BuyerPublicView): SearchCatalog {
  const items = view.page?.items ?? [];
  return {
    products: items.map((item) => ({
      id: item.id,
      title: item.title,
      storeId: item.seller.id,
      category: item.categoryId,
      images: item.images.slice(0, 1),
      price: item.price,
      priceFrom: item.priceFrom,
      ratingCount: "",
      variants: [],
    })),
    stores: [
      ...new Map(items.map((item) => [item.seller.id, item.seller])).values(),
    ].map((seller) => ({
      id: seller.id,
      name: seller.name,
      logo: "",
      ratingCount: "",
      categories: [],
    })),
  };
}

export function hasPublicSearchFilters(input: DiscoveryInput): boolean {
  return !!(
    input.category ||
    input.condition ||
    input.location ||
    input.minPriceMinor !== null ||
    input.maxPriceMinor !== null ||
    input.seller !== "all" ||
    input.sort !== "relevance" ||
    Object.keys(input.attributes).length
  );
}

/** Validate before navigation and retire the prior page cursor on a changed
 * query. Preserve supported category/attribute/scope/locale criteria. */
export function publicSearchQuery(
  input: DiscoveryInput,
  query: string,
): URLSearchParams {
  const next = discoverySearchParams(input);
  if (query.trim()) next.set("q", query.trim());
  else next.delete("q");
  return publicSearchFilterParams(readDiscoveryInput(next).input);
}

/** Applied criteria keep the selected language explicit, including Bulgarian
 * when a saved or browser preference differs. Pagination is retired. */
export function publicSearchFilterParams(
  input: DiscoveryInput,
): URLSearchParams {
  const params = discoverySearchParams(
    readDiscoveryInput(discoverySearchParams(input)).input,
  );
  params.set("lang", input.locale);
  return params;
}

export function clearPublicSearchFilters(
  input: DiscoveryInput,
): DiscoveryInput {
  return {
    ...input,
    category: null,
    condition: null,
    location: "",
    minPriceMinor: null,
    maxPriceMinor: null,
    attributes: {},
    seller: "all",
    sort: "relevance",
  };
}
