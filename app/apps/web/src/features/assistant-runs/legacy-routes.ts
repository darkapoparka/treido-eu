import { parseToolIntent, toolParams } from "../shopping-tools/intent";

/** Old reference URLs map to real tools without carrying recorded answers or
 * silently discarding a selected hard criterion. Unsupported input stays invalid. */
export function legacyAssistantDestination(
  kind: "assistant" | "sol" | "look",
  source: Record<string, string | string[] | undefined>,
  locale: "bg" | "en",
): string | null {
  const params = new URLSearchParams();
  let path =
    kind === "sol"
      ? "find-for-me/voice"
      : kind === "look"
        ? "photo-match"
        : "find-for-me";
  for (const [key, raw] of Object.entries(source)) {
    if (key === "example" && kind === "assistant") {
      if (raw === "photo") path = "photo-match";
      else if (raw !== undefined && raw !== "jeans") return null;
      continue;
    }
    for (const value of Array.isArray(raw) ? raw : [raw])
      if (value !== undefined) params.append(key, value);
  }
  if (!params.has("lang")) params.set("lang", locale);
  try {
    const intent = parseToolIntent(params.toString(), "find-for-me");
    if (intent.cursor) return null;
    return "/minis/" + path + "?" + toolParams(intent).toString();
  } catch {
    return null;
  }
}
