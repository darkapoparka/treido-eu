import { validId } from "../selling/draft-model";
export const STUDIO_SEARCH_GROUPS = ["all", "products", "orders", "customers", "navigation"] as const;
export type StudioSearchGroup = typeof STUDIO_SEARCH_GROUPS[number];
export type StudioSearchInput = { sellerId: string; actorSubject: string; q: string; group: StudioSearchGroup; language: "bg" | "en" };
export type StudioSearchItem = { id: string; group: Exclude<StudioSearchGroup, "all">; title: string; description: string; href: string };
export type StudioSearchView = {
  sellerId: string; actorSubject: string; q: string; group: StudioSearchGroup;
  groups: StudioSearchGroup[]; items: StudioSearchItem[]; customerScope: "recent_30";
};
export function parseStudioSearch(raw: unknown): StudioSearchInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["sellerId", "actorSubject", "q", "group", "language"].includes(key)) ||
    !validId(input.sellerId) || typeof input.actorSubject !== "string" || !input.actorSubject || input.actorSubject.length > 160 ||
    typeof input.q !== "string" || input.q.length > 160 || !STUDIO_SEARCH_GROUPS.includes(input.group as StudioSearchGroup) ||
    !["bg", "en"].includes(String(input.language))) return null;
  return { sellerId: input.sellerId, actorSubject: input.actorSubject, q: input.q.trim(), group: input.group as StudioSearchGroup, language: input.language as "bg" | "en" };
}
export function studioSearchGroups(capabilities: readonly string[]): StudioSearchGroup[] {
  const groups: StudioSearchGroup[] = ["all"];
  if (capabilities.includes("listing.read")) groups.push("products");
  if (capabilities.includes("order.read")) groups.push("orders", "customers");
  groups.push("navigation");
  return groups;
}
export function matchesStudioText(text: string, query: string) {
  return text.normalize("NFKC").toLocaleLowerCase().includes(query.normalize("NFKC").toLocaleLowerCase());
}
