import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { SellerError } from "../sellers/errors";
export type OwnCaseQuery = {
  state: "all" | "open" | "resolved";
  kind: "all" | "listing" | "message";
  q: string;
  before: string | null;
};
export function parseOwnCaseQuery(raw: unknown): OwnCaseQuery {
  if (
    !object(raw) ||
    Object.keys(raw).some((k) => !["state", "kind", "q", "before"].includes(k))
  )
    throw new SellerError("INVALID_INPUT");
  const state = raw.state ?? "all",
    kind = raw.kind ?? "all",
    q = raw.q ?? "",
    before = raw.before ?? null;
  if (
    !["all", "open", "resolved"].includes(String(state)) ||
    !["all", "listing", "message"].includes(String(kind)) ||
    typeof q !== "string" ||
    q.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(q) ||
    (before !== null &&
      (typeof before !== "string" ||
        before.length > 1024 ||
        (!validId(before) &&
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(before))))
  )
    throw new SellerError("INVALID_INPUT");
  return {
    state: state as OwnCaseQuery["state"],
    kind: kind as OwnCaseQuery["kind"],
    q: q.trim(),
    before: before as string | null,
  };
}
