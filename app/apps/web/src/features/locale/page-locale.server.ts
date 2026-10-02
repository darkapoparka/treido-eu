import "server-only";
import { parseLocale } from "./locale";
import { readLocaleRequest } from "./request.server";
export async function pageLocale(explicit: unknown) {
  return parseLocale(explicit) ?? (await readLocaleRequest()).locale;
}
