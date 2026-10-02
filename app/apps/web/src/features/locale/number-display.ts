import type { Locale } from "./locale";
/** Preserve source precision and currency; this is formatting, not new catalogue data. */
export function displayRating(
  value: number | string | undefined,
  locale: Locale,
) {
  if (value === undefined) return "";
  const number =
    typeof value === "number"
      ? value
      : /^\d+(?:\.\d+)?$/.test(value)
        ? Number(value)
        : null;
  return number === null
    ? value
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
        number,
      );
}
export function displayCount(
  value: string | number | undefined,
  locale: Locale,
) {
  if (value === undefined) return "";
  if (locale === "en") return String(value);
  const compact =
    typeof value === "string" ? /^(\d+(?:\.\d+)?)([KM])$/i.exec(value) : null;
  if (compact)
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(
      Number(compact[1]) * (compact[2].toUpperCase() === "K" ? 1000 : 1000000),
    );
  const number =
    typeof value === "number"
      ? value
      : /^\d+$/.test(value)
        ? Number(value)
        : null;
  return number === null
    ? String(value)
    : new Intl.NumberFormat(locale).format(number);
}
