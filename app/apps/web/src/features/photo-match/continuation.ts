import {
  parseToolIntent,
  toolParams,
  TOOL_LIMITS,
} from "../shopping-tools/intent";

export function parseAssistantInputContinuation(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > TOOL_LIMITS.queryBytes + 100 ||
    /[\\#\u0000-\u0020\u007f]/.test(raw)
  )
    return null;
  const photo = /^\/minis\/photo-match(?:\?lang=(bg|en))?$/.exec(raw);
  if (photo)
    return raw.length <= 120
      ? "/minis/photo-match?lang=" + (photo[1] ?? "bg")
      : null;
  if (!/^\/minis\/find-for-me\/voice(?:\?|$)/.test(raw)) return null;
  try {
    const url = new URL(raw, "https://treido.invalid");
    if (
      url.origin !== "https://treido.invalid" ||
      url.pathname !== "/minis/find-for-me/voice" ||
      url.hash ||
      url.username ||
      url.password ||
      url.searchParams.has("cursor")
    )
      return null;
    const intent = parseToolIntent(url.search.slice(1), "find-for-me");
    // A Voice/sign-in handoff carries public criteria, never pagination or a
    // private input/command identity. Unknown keys are rejected by the parser.
    return url.pathname + "?" + toolParams(intent);
  } catch {
    return null;
  }
}
