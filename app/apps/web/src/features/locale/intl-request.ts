import { getRequestConfig } from "next-intl/server";
import { readLocaleRequest } from "./request.server";
import { messages } from "./messages";
import { parseLocale } from "./locale";

export default getRequestConfig(async ({ locale: override }) => {
  const preference = await readLocaleRequest();
  const locale = parseLocale(override) ?? preference.locale;
  return { locale, messages: messages[locale], timeZone: preference.timeZone };
});
