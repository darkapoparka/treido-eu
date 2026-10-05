import { validId } from "../selling/draft-model";
/** Only canonical app-owned destinations may be used after sign-in. */
export function parseMessagingContinuation(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return null;
  if (
    [...value].some((c) => c.charCodeAt(0) < 33 || c.charCodeAt(0) > 126) ||
    value.includes("%") ||
    value.includes("#") ||
    value.includes("\\")
  )
    return null;
  const parts = value.split("?");
  if (parts.length > 2) return null;
  const [pathname, raw] = parts;
  const thread = /^[/]messages[/]([^/]+)$/.exec(pathname);
  const report = /^[/]messages[/](?:reports|appeals)[/]([^/]+)$/.exec(pathname);
  const seller = /^[/]app[/]sellers[/]([^/]+)[/]inbox(?:[/]([^/]+))?$/.exec(
    pathname,
  );
  const moderation =
    /^[/]app[/]sellers[/]([^/]+)[/]listings[/]([^/]+)[/]moderation$/.exec(
      pathname,
    );
  if (
    ![
      "/messages",
      "/messages/reports",
      "/messages/appeals",
      "/messages/new",
      "/messages/report",
    ].includes(pathname) &&
    !(thread && validId(thread[1])) &&
    !(report && validId(report[1])) &&
    !(seller && validId(seller[1]) && (!seller[2] || validId(seller[2]))) &&
    !(moderation && validId(moderation[1]) && validId(moderation[2]))
  )
    return null;
  const params = new URLSearchParams(raw),
    seen = new Set<string>();
  for (const [key, item] of params) {
    if (seen.has(key)) return null;
    seen.add(key);
    if (key === "lang" && (item === "bg" || item === "en")) continue;
    if (pathname === "/messages/new" && key === "listing" && validId(item))
      continue;
    if (
      pathname === "/messages/report" &&
      ((key === "kind" && ["listing", "message"].includes(item)) ||
        (key === "id" && validId(item)))
    )
      continue;
    return null;
  }
  if (pathname === "/messages/new" && !validId(params.get("listing")))
    return null;
  if (
    pathname === "/messages/report" &&
    (!validId(params.get("id")) ||
      !["listing", "message"].includes(params.get("kind") ?? ""))
  )
    return null;
  return pathname + (params.size ? "?" + params : "");
}
