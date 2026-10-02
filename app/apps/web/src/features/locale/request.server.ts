import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import {
  browserLocale,
  detectLocation,
  localeCookie,
  localeHeader,
  localeSourceHeader,
  parseLocale,
  resolveLocale,
} from "./locale";
import { readRegionCookie, regionCookie } from "./preferences-model";
export const readLocaleRequest = cache(async () => {
  const [requestHeaders, cookieStore] = await Promise.all([
    headers(),
    cookies(),
  ]);
  const locationSuggestion = detectLocation(
    requestHeaders,
    process.env.VERCEL === "1",
  );
  const savedRegion = readRegionCookie(cookieStore.get(regionCookie)?.value);
  const savedLocale = parseLocale(cookieStore.get(localeCookie)?.value);
  const preferredBrowserLocale = browserLocale(
    requestHeaders.get("accept-language"),
  );
  const detected = resolveLocale({
    saved: savedLocale,
    acceptLanguage: requestHeaders.get("accept-language"),
    country: locationSuggestion?.country,
  });
  return {
    locale: parseLocale(requestHeaders.get(localeHeader)) ?? detected.locale,
    source: requestHeaders.get(localeSourceHeader) ?? detected.source,
    locationSuggestion,
    savedRegion,
    savedLocale,
    preferredBrowserLocale,
    timeZone: savedRegion?.timeZone ?? "UTC",
  };
});
