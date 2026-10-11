import { validId } from "../selling/draft-model";
import { CATALOG_BATCH_SIZE } from "./catalog-organization-model";
export function parseCatalogSelection(raw: unknown): string[] | null {
  if (typeof raw !== "string" || raw.length > CATALOG_BATCH_SIZE * 37) return null;
  const ids = raw.split(",");
  if (!ids.length || ids.length > CATALOG_BATCH_SIZE || ids.some((id) => !validId(id))) return null;
  const normalized = ids.map((id) => id.toLowerCase());
  return new Set(normalized).size === normalized.length ? normalized.sort() : null;
}
/** Read destinations only; the page and command still check current authority. */
export function parseCatalogContinuation(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 4096 || !raw.startsWith("/app/sellers/") || /[\\#\u0000-\u0020\u007f]/.test(raw)) return null;
  const url = new URL(raw, "https://merchant.invalid");
  if (url.origin !== "https://merchant.invalid" || url.pathname !== raw.split("?")[0]) return null;
  const match = /^\/app\/sellers\/([^/]+)\/(collections(?:\/([^/]+)(?:\/(preview))?)?|catalog(?:\/(edit))?|customers\/([^/]+))$/.exec(url.pathname);
  if (!match || !validId(match[1]) || (match[3] !== undefined && !validId(match[3])) || (match[6] !== undefined && !validId(match[6]))) return null;
  const query = new URLSearchParams(), seen = new Set<string>();
  for (const [key, value] of url.searchParams) {
    if (seen.has(key)) return null;
    seen.add(key);
    if (key === "lang" && (value === "bg" || value === "en")) query.set(key, value);
    else if (match[5] && key === "ids") {
      const ids = parseCatalogSelection(value);
      if (!ids) return null;
      query.set(key, ids.join(","));
    } else if (match[6] && key === "before" && validId(value)) query.set(key, value.toLowerCase());
    else if (!match[5] && !match[6] && key === "q" && !match[4] && value.length <= 160 && !/[\u0000-\u001f\u007f]/.test(value)) query.set(key, value.trim());
    else if (!match[5] && !match[6] && key === "after" && validId(value)) query.set(key, value.toLowerCase());
    else return null;
  }
  if (match[5] && !query.has("ids")) return null;
  const path = `/app/sellers/${match[1].toLowerCase()}/${match[2].toLowerCase()}`;
  return path + (query.size ? `?${query}` : "");
}
