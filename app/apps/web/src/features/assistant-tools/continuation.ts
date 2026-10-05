import { getCategory } from "@treido/contracts/categories";
import { validId } from "../selling/draft-model";
/** Read-only navigation hints. Returning/signing in never saves requirements,
 * creates a helper proposal, changes seller authority or accepts a draft edit. */
export function parseAssistantContinuation(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 1000 ||
    !value.startsWith("/minis/") ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) <= 32 ||
        character.charCodeAt(0) === 127 ||
        character === "\\" ||
        character === "#",
    )
  )
    return null;
  const url = new URL(value, "https://treido.invalid");
  if (
    url.origin !== "https://treido.invalid" ||
    !["/minis/compatibility", "/minis/sell-helper"].includes(url.pathname)
  )
    return null;
  const compatibility = url.pathname === "/minis/compatibility";
  const allowed = compatibility
    ? ["lang", "listing", "categoryId"]
    : ["lang", "sellerId", "draftId"];
  if ([...url.searchParams.keys()].some((key) => !allowed.includes(key)))
    return null;
  for (const key of allowed.filter((key) => key !== "listing"))
    if (url.searchParams.getAll(key).length > 1) return null;
  const lang = url.searchParams.get("lang");
  if (lang !== null && !["bg", "en"].includes(lang)) return null;
  if (compatibility) {
    const ids = url.searchParams.getAll("listing");
    if (
      ids.length > 4 ||
      ids.some((id) => !validId(id)) ||
      new Set(ids.map((id) => id.toLowerCase())).size !== ids.length
    )
      return null;
    const categoryId = url.searchParams.get("categoryId");
    if (categoryId !== null && getCategory(categoryId)?.kind !== "leaf")
      return null;
  } else {
    const sellerId = url.searchParams.get("sellerId"),
      draftId = url.searchParams.get("draftId");
    if (
      (sellerId !== null && !validId(sellerId)) ||
      (draftId !== null && (!validId(draftId) || sellerId === null))
    )
      return null;
  }
  for (const key of ["listing", "sellerId", "draftId"]) {
    const ids = url.searchParams.getAll(key);
    if (ids.length) {
      url.searchParams.delete(key);
      for (const id of ids) url.searchParams.append(key, id.toLowerCase());
    }
  }
  return (
    url.pathname +
    (url.searchParams.size ? "?" + url.searchParams.toString() : "")
  );
}
