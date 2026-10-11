import { validId } from "../selling/draft-model";
import { parseOrderIndexQuery, orderIndexHref } from "../payments/order-index-model";
import { parseCustomerQuery } from "./customers-model";
import { parseCatalogContinuation } from "./catalog-navigation";

/** Merchant additions to private continuation allowlists. No external destination,
 * raw buyer identity, mutation or arbitrary query key can be supplied here. */
export function parseMerchantContinuation(raw: unknown): string | null {
  const catalog = parseCatalogContinuation(raw);
  if (catalog) return catalog;
  if (typeof raw !== "string" || raw.length > 2048 || !raw.startsWith("/app/sellers/") || /[\\#\u0000-\u0020\u007f]/.test(raw)) return null;
  const url = new URL(raw, "https://merchant.invalid");
  if (url.origin !== "https://merchant.invalid" || url.pathname !== raw.split("?")[0]) return null;
  const match = /^\/app\/sellers\/([^/]+)\/(orders|customers|sell-helper)$/.exec(url.pathname);
  if (!match || !validId(match[1])) return null;
  const seen = new Set<string>();
  for (const [key] of url.searchParams) { if (seen.has(key)) return null; seen.add(key); }
  const query = Object.fromEntries(url.searchParams), language = query.lang === "bg" ? "bg" : "en";
  const base = `/app/sellers/${match[1].toLowerCase()}/${match[2]}`;
  const canonical = new URLSearchParams();
  if (query.lang !== undefined) canonical.set("lang", query.lang);
  if (match[2] === "orders") {
    const parsed = parseOrderIndexQuery(query);
    if (!parsed) return null;
    const next = new URL(orderIndexHref(match[1].toLowerCase(), language, parsed, { before: parsed.before }), "https://merchant.invalid");
    if (query.lang === undefined) next.searchParams.delete("lang");
    return next.pathname + next.search;
  }
  if (match[2] === "customers") {
    const parsed = parseCustomerQuery(query);
    if (!parsed) return null;
    if (parsed.before) canonical.set("before", parsed.before);
  } else {
    if (Object.keys(query).some((key) => !["lang", "draftId"].includes(key)) ||
      (query.lang !== undefined && !["bg", "en"].includes(query.lang)) ||
      (query.draftId !== undefined && !validId(query.draftId))) return null;
    if (query.draftId) canonical.set("draftId", query.draftId.toLowerCase());
  }
  return base + (canonical.size ? `?${canonical}` : "");
}
