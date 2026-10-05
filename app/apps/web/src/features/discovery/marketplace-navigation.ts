import {
  discoverySearchParams,
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
