export function parseGiftContinuation(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 120 ||
    value.split("?")[0] !== "/minis/gift-finder" ||
    value.includes("\\") ||
    Array.from(value).some(
      (c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127,
    )
  )
    return null;
  try {
    const url = new URL(value, "https://treido.invalid");
    if (
      !value.startsWith("/minis/gift-finder") ||
      url.origin !== "https://treido.invalid" ||
      url.pathname !== "/minis/gift-finder" ||
      url.hash ||
      url.username ||
      url.password
    )
      return null;
    if (
      url.searchParams.getAll("lang").length > 1 ||
      [...url.searchParams].some(
        ([key, v]) => key !== "lang" || !["bg", "en"].includes(v),
      )
    )
      return null;
    return "/minis/gift-finder?lang=" + (url.searchParams.get("lang") ?? "bg");
  } catch {
    return null;
  }
}
