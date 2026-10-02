"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "./provider";
import { preferenceDestination, type Locale } from "./locale";
import { saveLocalizationPreferences } from "./preferences-actions";
export function LanguageChoice({
  locale,
  returnTo,
  className,
}: {
  locale: Locale;
  returnTo: string;
  className?: string;
}) {
  const current = useLocale();
  const router = useRouter();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        lang={locale}
        disabled={pending}
        aria-pressed={current.locale === locale}
        onClick={() => {
          setFailed(false);
          start(async () => {
            try {
              const region = current.savedRegion ?? {
                country: null,
                locality: "",
                timeZone: current.timeZone ?? "UTC",
              };
              const result = await saveLocalizationPreferences({
                ...region,
                locale,
              });
              if (!active.current) return;
              if (!result.ok) {
                setFailed(true);
                return;
              }
              router.push(
                preferenceDestination(returnTo, locale, region.locality),
                { scroll: false },
              );
              router.refresh();
            } catch {
              if (active.current) setFailed(true);
            }
          });
        }}
      >
        {locale === "bg" ? "Български" : "English"}
      </button>
      {failed && <p role="alert">{current.messages.preferences.saveFailed}</p>}
    </>
  );
}
