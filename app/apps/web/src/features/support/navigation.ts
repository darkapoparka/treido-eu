import { validId } from "../selling/draft-model";
/** A continuation preserves intent, never grants access to a private request. */
export function parseSupportContinuation(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512 || /[%\\#\s\u0000-\u001f\u007f-\uffff]/.test(value)) return null;
  const parts = value.split("?");
  if (parts.length > 2) return null;
  const match = /^\/(?:support\/requests|ops\/support)(?:\/([^/]+))?$/.exec(parts[0]);
  if (!match || (match[1] !== undefined && !validId(match[1]))) return null;
  const params = new URLSearchParams(parts[1]), seen = new Set<string>();
  for (const [key, item] of params) {
    if (seen.has(key)) return null;
    seen.add(key);
    if (key === "lang" && ["bg", "en"].includes(item)) continue;
    if (!match[1] && key === "state" && ["all", "open", "waiting", "resolved"].includes(item)) continue;
    if (!match[1] && key === "before" && validId(item)) continue;
    if (match[1] && key === "beforeSequence" && /^[1-9][0-9]{0,8}$/.test(item)) continue;
    return null;
  }
  params.sort();
  return parts[0] + (params.size ? "?" + params.toString() : "");
}
