export function parseAssistantInputContinuation(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > 120 ||
    /[\\\u0000-\u0020\u007f]/.test(raw)
  )
    return null;
  const match =
    /^\/minis\/(photo-match|find-for-me\/voice)(?:\?lang=(bg|en))?$/.exec(raw);
  return match ? "/minis/" + match[1] + "?lang=" + (match[2] ?? "bg") : null;
}
