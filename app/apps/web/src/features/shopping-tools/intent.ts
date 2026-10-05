import { getCategory } from "@treido/contracts/categories";
import {
  readDiscoveryInput,
  discoverySearchParams,
  type DiscoveryInput,
} from "../catalog/discovery-input";
import { discoveryTerms } from "../catalog/public-discovery-model";
import { SellerError } from "../sellers/errors";
export const TOOL_LIMITS = {
  results: 20,
  selections: 4,
  attributes: 6,
  commandsPerMinute: 60,
  queryBytes: 6000,
} as const;
export type ToolMode = "find-for-me" | "deal-finder";
export type ToolIntent = {
  discovery: DiscoveryInput;
  handover: "any" | "pickup" | "shipping";
  availability: "any" | "known";
  cursor: string | null;
};
/** Unlike ordinary browse repair, a shopping tool must never silently drop a hard constraint. */
export function parseToolIntent(raw: unknown, mode: ToolMode): ToolIntent {
  if (
    typeof raw !== "string" ||
    raw.length > TOOL_LIMITS.queryBytes ||
    new TextEncoder().encode(raw).byteLength > TOOL_LIMITS.queryBytes
  )
    throw new SellerError("INVALID_INPUT");
  const params = new URLSearchParams(raw);
  if ([...params].length > 48) throw new SellerError("INVALID_INPUT");
  const single = (key: string, fallback: string) => {
    if (params.getAll(key).length > 1) throw new SellerError("INVALID_INPUT");
    const value = params.get(key) || fallback;
    params.delete(key);
    return value;
  };
  const handover = single("handover", "any"),
    availability = single("availability", "any");
  if (
    !["any", "pickup", "shipping"].includes(handover) ||
    !["any", "known"].includes(availability)
  )
    throw new SellerError("INVALID_INPUT");
  // Only a single known empty form control means no criterion. An empty
  // duplicate must never erase another value, including a hard budget/filter.
  const optional = new Set([
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
  for (const [key, value] of [...params]) {
    if (value.length > 1024) throw new SellerError("INVALID_INPUT");
    if (!value) {
      if (!optional.has(key) || params.getAll(key).length !== 1)
        throw new SellerError("INVALID_INPUT");
      params.delete(key);
    }
  }
  const parsed = readDiscoveryInput(params);
  if (
    parsed.adjusted.length ||
    discoveryTerms(parsed.input.q).length > 8 ||
    Object.keys(parsed.input.attributes).length > TOOL_LIMITS.attributes
  )
    throw new SellerError("INVALID_INPUT");
  if (
    mode === "deal-finder" &&
    params.has("sort") &&
    parsed.input.sort !== "price_asc"
  )
    throw new SellerError("INVALID_INPUT");
  const category = parsed.input.category
    ? getCategory(parsed.input.category)
    : null;
  if (
    category?.kind === "leaf" &&
    parsed.input.condition &&
    !category.policy.conditions.includes(parsed.input.condition)
  )
    throw new SellerError("INVALID_INPUT");
  return {
    discovery: {
      ...parsed.input,
      sort: mode === "deal-finder" ? "price_asc" : parsed.input.sort,
    },
    handover: handover as ToolIntent["handover"],
    availability: availability as ToolIntent["availability"],
    cursor: parsed.cursor,
  };
}
export function toolParams(intent: ToolIntent, cursor: string | null = null) {
  const params = discoverySearchParams(intent.discovery, cursor);
  if (intent.handover !== "any") params.set("handover", intent.handover);
  if (intent.availability !== "any")
    params.set("availability", intent.availability);
  params.set("lang", intent.discovery.locale);
  return params;
}
export function toolHref(
  mode: ToolMode,
  intent: ToolIntent,
  cursor: string | null = null,
) {
  return "/minis/" + mode + "?" + toolParams(intent, cursor);
}
export function parseShoppingToolContinuation(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > TOOL_LIMITS.queryBytes + 100 ||
    !raw.startsWith("/minis") ||
    /[\\\u0000-\u001f\u007f]/.test(raw)
  )
    return null;
  try {
    const url = new URL(raw, "https://treido.invalid");
    if (
      url.origin !== "https://treido.invalid" ||
      url.hash ||
      url.username ||
      url.password
    )
      return null;
    if (url.pathname === "/minis" || url.pathname === "/minis/compare") {
      if (
        [...url.searchParams].some(
          ([k, v]) => k !== "lang" || !["bg", "en"].includes(v),
        ) ||
        url.searchParams.getAll("lang").length > 1
      )
        return null;
      return url.pathname + "?lang=" + (url.searchParams.get("lang") ?? "bg");
    }
    const mode = url.pathname.slice(7);
    if (mode !== "find-for-me" && mode !== "deal-finder") return null;
    const input = parseToolIntent(url.search.slice(1), mode);
    // Sign-in continuation never executes an add, contact or cart command.
    return toolHref(mode, input, input.cursor);
  } catch {
    return null;
  }
}
