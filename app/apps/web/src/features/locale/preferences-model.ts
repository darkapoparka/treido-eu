import { parseLocale, type Locale } from "./locale";
import { parseCountry, parseLocality, parseTimeZone } from "./regions";
export const regionCookie = "treido-region";
export type RegionPreference = {
  country: string | null;
  locality: string;
  timeZone: string;
};
export type LocalizationPreference = RegionPreference & { locale: Locale };
export function parseRegionPreference(value: unknown): RegionPreference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !["country", "locality", "timeZone"].includes(key),
    )
  )
    return null;
  const country = input.country === null ? null : parseCountry(input.country);
  const locality = parseLocality(input.locality),
    timeZone = parseTimeZone(input.timeZone);
  if ((input.country !== null && !country) || locality === null || !timeZone)
    return null;
  return { country, locality, timeZone };
}
export function parseLocalizationPreference(
  value: unknown,
): LocalizationPreference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { locale, ...region } = value as Record<string, unknown>;
  const language = parseLocale(locale),
    preference = parseRegionPreference(region);
  return language && preference ? { locale: language, ...preference } : null;
}
export function readRegionCookie(
  raw: string | undefined,
): RegionPreference | null {
  if (!raw || raw.length > 1600) return null;
  try {
    return parseRegionPreference(JSON.parse(decodeURIComponent(raw)));
  } catch {
    return null;
  }
}
