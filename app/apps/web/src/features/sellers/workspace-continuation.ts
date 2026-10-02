import { validId } from "../selling/draft-model";
import { parseMessagingContinuation } from "../messaging/navigation-model";

/** Additional private entry paths, independently reauthorised by every destination. */
export function parseWorkspaceContinuation(value: unknown): string | null {
  const messaging = parseMessagingContinuation(value);
  if (messaging) return messaging;
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    /[%\\#\s\u0000-\u001f\u007f-\uffff]/.test(value)
  )
    return null;
  const parts = value.split("?");
  if (parts.length > 2) return null;
  const [path, query] = parts;
  const seller =
    /^\/app\/sellers\/([^/]+)(?:\/(onboarding|settings|listings))?$/.exec(path);
  const review = /^\/app\/sellers\/([^/]+)\/listings\/([^/]+)\/review$/.exec(
    path,
  );
  if (
    ![
      "/app",
      "/app/products",
      "/app/intent",
      "/app/onboarding",
      "/ops",
    ].includes(path) &&
    (!seller || !validId(seller[1])) &&
    (!review || !validId(review[1]) || !validId(review[2]))
  )
    return null;
  const params = new URLSearchParams(query);
  const seen = new Set<string>();
  for (const [key, item] of params) {
    if (seen.has(key)) return null;
    seen.add(key);
    if (key === "lang" && ["bg", "en"].includes(item)) continue;
    if (
      key === "step" &&
      seller?.[2] === "onboarding" &&
      ["details", "declaration", "review"].includes(item)
    )
      continue;
    return null;
  }
  const canonical = new URLSearchParams();
  if (params.has("step")) canonical.set("step", params.get("step")!);
  if (params.has("lang")) canonical.set("lang", params.get("lang")!);
  return path + (canonical.size ? `?${canonical}` : "");
}
