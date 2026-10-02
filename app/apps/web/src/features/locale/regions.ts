import countries from "./countries.json";
import countryLabels from "./country-options.json";
import type { Locale } from "./locale";
const countrySet = new Set(countries);
export function parseCountry(value: unknown): string | null {
  return typeof value === "string" && countrySet.has(value) ? value : null;
}
// Checked-in CLDR labels and order keep server/browser ICU versions from drifting.
export function countryName(country: string, locale: Locale): string {
  return (
    countryLabels[locale].find((item) => item.code === country)?.name ?? country
  );
}
export function countryOptions(locale: Locale) {
  return countryLabels[locale];
}
export function parseTimeZone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 80) return null;
  try {
    return new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions()
      .timeZone;
  } catch {
    return null;
  }
}
export function parseLocality(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 80 ||
    /[\p{Cc}\p{Cf}<>]/u.test(value)
  )
    return null;
  return value.trim();
}
