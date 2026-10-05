import { validId } from "../selling/draft-model";

/** The feedback owner's public read permits only ten bounded pages. */
export function purchaseFeedbackPage(value: unknown): number | null {
  if (value === undefined) return 0;
  return typeof value === "string" && /^[0-9]$/.test(value)
    ? Number(value)
    : null;
}
export function purchaseFeedbackHref(
  sellerId: string,
  locale: "bg" | "en",
  page: number,
): string {
  if (
    !validId(sellerId) ||
    !["bg", "en"].includes(locale) ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 9
  )
    throw new RangeError("INVALID_FEEDBACK_PAGE");
  const params = new URLSearchParams({ lang: locale });
  if (page) params.set("feedbackPage", String(page));
  return `/stores/${sellerId}/info?${params}`;
}
