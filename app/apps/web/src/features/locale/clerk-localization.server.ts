import "server-only";
import type { Locale } from "./locale";

/** Load only the selected UI dictionary on the server, not all Clerk languages. */
export async function clerkLocalization(locale: Locale) {
  if (locale === "bg") {
    const { bgBG } = await import("@clerk/localizations/bg-BG");
    return bgBG;
  }
  const { enUS } = await import("@clerk/localizations/en-US");
  return enUS;
}
