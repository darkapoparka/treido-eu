"use client";
import { NextIntlClientProvider } from "next-intl";
import type { RegionPreference } from "./preferences-model";
import { useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { parseLocale, type Locale, type LocationSuggestion } from "./locale";
import { messages } from "./messages";

type Preference = {
  locale: Locale;
  locationSuggestion: LocationSuggestion | null;
  savedRegion?: RegionPreference | null;
  savedLocale?: Locale | null;
  preferredBrowserLocale?: Locale | null;
  timeZone?: string;
};
const LocaleContext = createContext<Preference>({
  locale: "en",
  locationSuggestion: null,
});
export function LocaleProvider({
  initial,
  children,
}: {
  initial: Preference;
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <LocaleContext.Provider value={initial}>
          <NextIntlClientProvider
            locale={initial.locale}
            messages={messages[initial.locale]}
            timeZone={initial.timeZone ?? "UTC"}
          >
            {children}
          </NextIntlClientProvider>
        </LocaleContext.Provider>
      }
    >
      <RouteLocale initial={initial}>{children}</RouteLocale>
    </Suspense>
  );
}
function RouteLocale({
  initial,
  children,
}: {
  initial: Preference;
  children: ReactNode;
}) {
  const params = useSearchParams();
  const locale = parseLocale(params.get("lang")) ?? initial.locale;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <LocaleContext.Provider value={{ ...initial, locale }}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages[locale]}
        timeZone={initial.timeZone ?? "UTC"}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
export function useLocale() {
  const context = useContext(LocaleContext);
  return { ...context, messages: messages[context.locale] };
}
