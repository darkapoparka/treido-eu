import { parseCountry, parseLocality } from "./regions";

export const locales = ["bg", "en"] as const;
export type Locale = (typeof locales)[number];
export const localeCookie = "treido-locale";
export const localeHeader = "x-treido-locale";
export const localeSourceHeader = "x-treido-locale-source";

export function parseLocale(value: unknown): Locale | null {
  return value === "bg" || value === "en" ? value : null;
}

/** Only a language preference is inferred; it never changes the search area. */
export function browserLocale(header: string | null): Locale | null {
  const preferences = (header ?? "")
    .slice(0, 2048)
    .split(",")
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const weight = parameters.find((part) => part.trim().startsWith("q="));
      const quality = weight ? weight.trim().slice(2) : "1";
      const q = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(quality)
        ? Number(quality)
        : 0;
      const language = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(tag)
        ? parseLocale(tag.split("-")[0].toLowerCase())
        : null;
      return { language, q, index };
    });
  return (
    preferences
      .sort((a, b) => b.q - a.q || a.index - b.index)
      .find((item) => item.language && item.q > 0)?.language ?? null
  );
}

export function resolveLocale(input: {
  explicit?: unknown;
  saved?: unknown;
  acceptLanguage?: string | null;
  country?: unknown;
}) {
  const explicit = parseLocale(input.explicit);
  if (explicit) return { locale: explicit, source: "url" as const };
  const saved = parseLocale(input.saved);
  if (saved) return { locale: saved, source: "saved" as const };
  const browser = browserLocale(input.acceptLanguage ?? null);
  if (browser) return { locale: browser, source: "browser" as const };
  return {
    locale: input.country === "BG" ? ("bg" as const) : ("en" as const),
    source: "default" as const,
  };
}

export type LocationSuggestion = { country: string; city: string | null };

/** Hosting country/city are approximate hints, never identity or fulfilment facts. */
export function detectLocation(
  headers: Pick<Headers, "get">,
  vercel: boolean,
): LocationSuggestion | null {
  if (!vercel) return null;
  const country = headers.get("x-vercel-ip-country");
  if (!parseCountry(country)) return null;
  let city = headers.get("x-vercel-ip-city");
  try {
    city = city ? decodeURIComponent(city) : null;
  } catch {
    city = null;
  }
  if (city && (city.length > 80 || /[\p{Cc}\p{Cf}<>]/u.test(city))) city = null;
  return { country: country!, city: parseLocality(city) || null };
}

/** Language context is public preference; no seller account/filter is added. */
export function localeDestination(href: string, locale: Locale | null) {
  if (
    !locale ||
    !href.startsWith("/") ||
    href.startsWith("//") ||
    /[\\\p{Cc}]/u.test(href)
  )
    return href;
  const url = new URL(href, "https://treido.invalid");
  if (/^\/(api|_next)(\/|$)/.test(url.pathname)) return href;
  if (!parseLocale(url.searchParams.get("lang")))
    url.searchParams.set("lang", locale);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function languageSettingsReturn(value: string | null) {
  if (
    !value ||
    value.length > 2048 ||
    /[\\\p{Cc}]/u.test(value) ||
    value.startsWith("//")
  )
    return "/profile";
  let url: URL;
  try {
    url = new URL(value, "https://treido.invalid");
  } catch {
    return "/profile";
  }
  if (
    url.origin !== "https://treido.invalid" ||
    !/^\/(?:profile|search|explore|orders|cart|deals|saved|following|sell|account(?:\/[^/]+)?|admin-preview(?:\/[^?#]*)?|app(?:\/[^?#]*)?|products(?:\/[^/]+)?|stores(?:\/[^/]+)?|minis(?:\/[^/]+)?)?\/?$/.test(
      url.pathname,
    )
  )
    return "/profile";
  return `${url.pathname}${url.search}${url.hash}`;
}

export function preferenceDestination(
  href: string,
  locale: Locale,
  location: string,
) {
  const url = new URL(languageSettingsReturn(href), "https://treido.invalid");
  url.searchParams.set("lang", locale);
  // Private seller routes keep their own exact query contract.
  if (!/^\/(?:app|admin-preview)(?:\/|$)/.test(url.pathname)) {
    url.searchParams.delete("page");
    url.searchParams.delete("cursor");
    if (location.trim()) url.searchParams.set("location", location.trim());
    else url.searchParams.delete("location");
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
