import { CATEGORY_REGISTRY_VERSION } from "@treido/contracts/categories";
import { onlyKeys, whole } from "../inventory/model";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import {
  parseToolIntent,
  toolParams,
  type ToolIntent,
  type ToolMode,
} from "../shopping-tools/intent";
import type { Observation, ToolListing } from "../shopping-tools/model";

export const SEARCH_LIMITS = {
  searches: 20,
  name: 80,
  commandsPerMinute: 60,
  page: 20,
  observations: 200,
  cataloguePages: 10,
  observedBatch: 4,
  schedulerBatch: 10,
} as const;
export type SearchStatus = "paused" | "enabled" | "removed";
export type Criteria = { mode: ToolMode; query: string; registry: number };
export type SearchSummary = {
  id: string;
  name: string;
  status: Exclude<SearchStatus, "removed">;
  version: number;
  generation: number;
  frequency: 60 | 1440;
  criteria: Criteria;
  intent: ToolIntent | null;
  needsReview: boolean;
  consentAt: string | null;
  lastCheckAt: string | null;
  run: {
    state: "running" | "bounded" | "finished" | "cancelled" | "failed";
    checked: number;
    observed: number;
  } | null;
};
export type SearchView = {
  actorKey: string;
  revision: number;
  searches: SearchSummary[];
  checkedAt: string;
};
export type SearchOperation =
  | {
      kind: "save";
      name: string;
      criteria: Criteria;
      enable: boolean;
      frequency: 60 | 1440;
    }
  | { kind: "rename"; searchId: string; name: string }
  | { kind: "criteria"; searchId: string; criteria: Criteria }
  | { kind: "enable"; searchId: string; frequency: 60 | 1440 }
  | { kind: "pause" | "remove" | "check"; searchId: string }
  | { kind: "read"; notificationIds: string[] };
export type SearchCommand = {
  actorKey: string;
  expectedRevision: number;
  requestId: string;
  operation: SearchOperation;
};
export type SearchChange = {
  revision: number;
  searchId: string | null;
  version: number | null;
  replayed: boolean;
};
export type MatchKind =
  "new_publication" | "price_changed" | "stock_changed" | "unavailable";
export type MatchItem = {
  id: string;
  searchId: string;
  searchName: string;
  kind: MatchKind;
  version: number;
  previousCriteria: boolean;
  paused: boolean;
  listingId: string;
  previous: Observation | null;
  observed: Observation | null;
  current: ToolListing | null;
  at: string;
  unread: boolean;
};
export type MatchFeed = {
  items: MatchItem[];
  nextCursor: string | null;
  unreadCount: number;
  available: boolean;
};
const invalid = (): never => {
  throw new SellerError("INVALID_INPUT");
};
const id = (raw: unknown): string =>
  validId(raw) ? raw.toLowerCase() : invalid();
function name(raw: unknown) {
  if (
    typeof raw !== "string" ||
    raw.length > SEARCH_LIMITS.name ||
    /[\u0000-\u001f\u007f]/.test(raw)
  )
    return invalid();
  const value = raw.trim().replace(/\s+/g, " ");
  return value ? value : invalid();
}
const frequency = (raw: unknown): 60 | 1440 =>
  raw === 60 || raw === 1440 ? raw : invalid();
export function reviewedCriteria(intent: ToolIntent, mode: ToolMode): Criteria {
  return {
    mode,
    query: toolParams(intent).toString(),
    registry: CATEGORY_REGISTRY_VERSION,
  };
}
export function parseCriteria(raw: unknown): Criteria {
  if (
    !onlyKeys(raw, ["mode", "query", "registry"]) ||
    (raw.mode !== "find-for-me" && raw.mode !== "deal-finder") ||
    raw.registry !== CATEGORY_REGISTRY_VERSION
  )
    return invalid();
  const intent = parseToolIntent(raw.query, raw.mode);
  if (intent.cursor) return invalid();
  return reviewedCriteria(intent, raw.mode);
}
export function criteriaIntent(criteria: Criteria): ToolIntent | null {
  if (criteria.registry !== CATEGORY_REGISTRY_VERSION) return null;
  try {
    return parseToolIntent(criteria.query, criteria.mode);
  } catch {
    return null;
  }
}
export function parseSearchCommand(
  raw: unknown,
  historical = false,
): SearchCommand {
  if (
    !onlyKeys(raw, [
      "actorKey",
      "expectedRevision",
      "requestId",
      "operation",
    ]) ||
    typeof raw.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey) ||
    !whole(raw.expectedRevision, 0, 2147483646) ||
    !onlyKeys(raw.operation, [
      "kind",
      "searchId",
      "criteria",
      "name",
      "enable",
      "frequency",
      "notificationIds",
    ])
  )
    return invalid();
  const op = raw.operation;
  const criteria = (value: unknown): Criteria => {
    if (!historical) return parseCriteria(value);
    if (
      !onlyKeys(value, ["mode", "query", "registry"]) ||
      (value.mode !== "find-for-me" && value.mode !== "deal-finder") ||
      !whole(value.registry, 1, 2147483646) ||
      typeof value.query !== "string" ||
      new TextEncoder().encode(value.query).byteLength > 6000
    )
      return invalid();
    return { mode: value.mode, query: value.query, registry: value.registry };
  };
  let operation: SearchOperation;
  if (
    op.kind === "save" &&
    onlyKeys(op, ["kind", "name", "criteria", "enable", "frequency"]) &&
    typeof op.enable === "boolean"
  )
    operation = {
      kind: "save",
      name: name(op.name),
      criteria: criteria(op.criteria),
      enable: op.enable,
      frequency: frequency(op.frequency),
    };
  else if (op.kind === "rename" && onlyKeys(op, ["kind", "searchId", "name"]))
    operation = {
      kind: "rename",
      searchId: id(op.searchId),
      name: name(op.name),
    };
  else if (
    op.kind === "criteria" &&
    onlyKeys(op, ["kind", "searchId", "criteria"])
  )
    operation = {
      kind: "criteria",
      searchId: id(op.searchId),
      criteria: criteria(op.criteria),
    };
  else if (
    op.kind === "enable" &&
    onlyKeys(op, ["kind", "searchId", "frequency"])
  )
    operation = {
      kind: "enable",
      searchId: id(op.searchId),
      frequency: frequency(op.frequency),
    };
  else if (
    (op.kind === "pause" || op.kind === "remove" || op.kind === "check") &&
    onlyKeys(op, ["kind", "searchId"])
  )
    operation = { kind: op.kind, searchId: id(op.searchId) };
  else if (
    op.kind === "read" &&
    onlyKeys(op, ["kind", "notificationIds"]) &&
    Array.isArray(op.notificationIds) &&
    op.notificationIds.length > 0 &&
    op.notificationIds.length <= SEARCH_LIMITS.page
  ) {
    const notificationIds = op.notificationIds.map(id);
    if (new Set(notificationIds).size !== notificationIds.length)
      return invalid();
    operation = { kind: "read", notificationIds };
  } else return invalid();
  return {
    actorKey: raw.actorKey,
    expectedRevision: raw.expectedRevision,
    requestId: id(raw.requestId),
    operation,
  };
}
export function savedSearchHref(locale: string, searchId?: string) {
  const params = new URLSearchParams({ lang: locale === "en" ? "en" : "bg" });
  if (searchId) params.set("search", id(searchId));
  return "/minis/saved-searches?" + params;
}
export function parseSearchContinuation(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > 1024 ||
    !raw.startsWith("/minis/saved-searches") ||
    /[\\\u0000-\u001f\u007f]/.test(raw)
  )
    return null;
  try {
    const url = new URL(raw, "https://treido.invalid");
    if (
      url.origin !== "https://treido.invalid" ||
      url.pathname !== "/minis/saved-searches" ||
      url.hash ||
      url.username ||
      url.password ||
      [...url.searchParams].some(([k]) => !["lang", "search"].includes(k)) ||
      url.searchParams.getAll("lang").length > 1 ||
      url.searchParams.getAll("search").length > 1
    )
      return null;
    const lang = url.searchParams.get("lang") ?? "bg",
      search = url.searchParams.get("search");
    if (!["bg", "en"].includes(lang) || (search !== null && !validId(search)))
      return null;
    return savedSearchHref(lang, search ?? undefined);
  } catch {
    return null;
  }
}
