import { validId } from "../selling/draft-model";
import { notificationsHref, parseNotificationQuery } from "./model";
/** Notification-only continuation; no arbitrary origin/path or repeated keys. */
export function parseNotificationContinuation(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value, "https://treido.invalid");
    const seller = /^\/app\/sellers\/([^/]+)\/notifications$/.exec(
      url.pathname,
    );
    if (
      url.origin !== "https://treido.invalid" ||
      url.hash ||
      (url.pathname !== "/notifications" && (!seller || !validId(seller[1])))
    )
      return null;
    const keys = [...url.searchParams.keys()];
    if (
      new Set(keys).size !== keys.length ||
      keys.some((k) => !["lang", "filter", "kind", "q", "before"].includes(k))
    )
      return null;
    const lang = url.searchParams.get("lang") ?? "en";
    if (lang !== "en" && lang !== "bg") return null;
    const query = parseNotificationQuery({
      sellerId: seller?.[1] ?? null,
      filter: url.searchParams.get("filter") ?? undefined,
      kind: url.searchParams.get("kind") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      before: url.searchParams.get("before"),
    });
    return notificationsHref(query.sellerId, lang, query);
  } catch {
    return null;
  }
}
