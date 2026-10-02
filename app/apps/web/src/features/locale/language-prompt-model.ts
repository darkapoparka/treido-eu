import { parseLocale, type Locale } from "./locale";
export const languagePromptCookie = "treido-language-prompt";
export function languagePromptEligible(
  pathname: string,
  saved: unknown,
  dismissed: boolean,
) {
  return (
    !parseLocale(saved) &&
    !dismissed &&
    /^\/(?:search|explore|profile|saved|following|deals|products(?:\/[^/]+)?|stores(?:\/[^/]+)?)?\/?$/.test(
      pathname,
    )
  );
}
export function languageSwitchDestination(href: string, locale: Locale) {
  if (
    href.length > 4096 ||
    !href.startsWith("/") ||
    href.startsWith("//") ||
    /[\\\p{Cc}]/u.test(href)
  )
    return "/?lang=" + locale;
  let url: URL;
  try {
    url = new URL(href, "https://treido.invalid");
  } catch {
    return "/?lang=" + locale;
  }
  if (url.origin !== "https://treido.invalid") return "/?lang=" + locale;
  url.searchParams.set("lang", locale);
  // Language is a display preference. Keep all filters and seller context.
  url.searchParams.delete("cursor");
  return url.pathname + url.search + url.hash;
}
