"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createTranslator } from "next-intl";
import {
  languageSettingsReturn,
  localeDestination,
  preferenceDestination,
  type Locale,
} from "./locale";
import { countryName, countryOptions, parseTimeZone } from "./regions";
import { messages } from "./messages";
import { useLocale } from "./provider";
import { saveLocalizationPreferences } from "./preferences-actions";
import {
  LocationError,
  requestDeviceCity,
  type DeviceLocationError,
} from "./device-location";
import styles from "./preferences.module.css";

export function LanguagePreferences() {
  const preference = useLocale();
  const params = useSearchParams();
  const returnTo = languageSettingsReturn(params.get("returnTo"));
  return (
    <PreferenceForm key={preference.locale + returnTo} returnTo={returnTo} />
  );
}
function PreferenceForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const preference = useLocale();
  const [selected, setSelected] = useState<Locale>(preference.locale);
  const [country, setCountry] = useState(preference.savedRegion?.country ?? "");
  const [location, setLocation] = useState(
    new URL(returnTo, "https://treido.invalid").searchParams.get("location") ??
      preference.savedRegion?.locality ??
      "",
  );
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] =
    useState<DeviceLocationError | null>(null);
  const [saveError, setSaveError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  const t = useMemo(
    () =>
      createTranslator({
        locale: selected,
        messages: messages[selected],
        namespace: "preferences",
      }),
    [selected],
  );
  const options = useMemo(() => countryOptions(selected), [selected]);
  const suggestion = preference.locationSuggestion;
  const detect = async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLocating(true);
    setLocationError(null);
    try {
      const result = await requestDeviceCity(selected, request.signal);
      if (!request.signal.aborted && active.current) {
        setCountry(result.country);
        setLocation(result.city ?? "");
      }
    } catch (error) {
      if (!request.signal.aborted && active.current)
        setLocationError(
          error instanceof LocationError ? error.code : "unavailable",
        );
    } finally {
      if (!request.signal.aborted && active.current) setLocating(false);
    }
  };
  const cancel = () => {
    active.current = false;
    controller.current?.abort();
  };
  return (
    <main
      lang={selected}
      className={"shop-page account-page account-settings-page " + styles.page}
    >
      <header className="account-heading">
        <h1>{t("title")}</h1>
      </header>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          setSaveError(false);
          const timeZone =
            parseTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone) ??
            preference.timeZone ??
            "UTC";
          startTransition(async () => {
            try {
              const result = await saveLocalizationPreferences({
                locale: selected,
                country: country || null,
                locality: location,
                timeZone,
              });
              if (!active.current) return;
              if (!result.ok) {
                setSaveError(true);
                return;
              }
              router.push(preferenceDestination(returnTo, selected, location), {
                scroll: false,
              });
              router.refresh();
            } catch {
              if (active.current) setSaveError(true);
            }
          });
        }}
      >
        <section className={"account-panel " + styles.panel}>
          <label htmlFor="preferred-language">{t("language")}</label>
          <select
            id="preferred-language"
            value={selected}
            disabled={pending || locating}
            onChange={(event) => setSelected(event.target.value as Locale)}
          >
            <option value="bg" lang="bg">
              Български
            </option>
            <option value="en" lang="en">
              English
            </option>
          </select>
          <p className="form-note">{t("languageNote")}</p>
          {preference.preferredBrowserLocale &&
            preference.preferredBrowserLocale !== selected && (
              <button
                type="button"
                className={"pill " + styles.suggestion}
                disabled={pending || locating}
                onClick={() => setSelected(preference.preferredBrowserLocale!)}
              >
                {t("useLanguage", {
                  language:
                    preference.preferredBrowserLocale === "bg"
                      ? "Български"
                      : "English",
                })}
              </button>
            )}
          <p className="form-note">{t("publishedLanguages")}</p>
        </section>
        <section className={"account-panel " + styles.panel}>
          <label htmlFor="preferred-country">{t("country")}</label>
          <select
            id="preferred-country"
            value={country}
            disabled={pending || locating}
            onChange={(event) => setCountry(event.target.value)}
          >
            <option value="">{t("everywhere")}</option>
            {options.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
          <p className="form-note">{t("countryNote")}</p>
          <label htmlFor="browsing-location">{t("location")}</label>
          <input
            id="browsing-location"
            value={location}
            disabled={pending || locating}
            maxLength={80}
            placeholder={t("locationPlaceholder")}
            autoComplete="address-level2"
            onChange={(event) => setLocation(event.target.value)}
          />
          <p className="form-note">{t("locationNote")}</p>
          {suggestion ? (
            <div data-location-suggestion>
              <strong>{t("detected")}</strong>
              <p>
                {[suggestion.city, countryName(suggestion.country, selected)]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="form-note">{t("approximate")}</p>
              <button
                type="button"
                className={"pill " + styles.suggestion}
                disabled={pending || locating}
                onClick={() => {
                  setCountry(suggestion.country);
                  setLocation(suggestion.city ?? "");
                }}
              >
                {t("useRegion")}
              </button>
            </div>
          ) : (
            <p className="form-note" data-location-unavailable>
              {t("unavailable")}
            </p>
          )}
          <p id="device-location-notice" className="form-note">
            {t("deviceNotice")}
          </p>
          <button
            type="button"
            className={"pill " + styles.suggestion}
            aria-describedby="device-location-notice"
            disabled={pending || locating}
            aria-busy={locating}
            onClick={() => void detect()}
          >
            {locating ? t("locating") : t("useDevice")}
          </button>
          {locationError && (
            <p className="form-note" role="status">
              {t(
                (
                  {
                    denied: "deviceDenied",
                    unsupported: "deviceUnsupported",
                    timeout: "deviceTimeout",
                    unavailable: "deviceUnavailable",
                  } as const
                )[locationError],
              )}
            </p>
          )}
          <p className="form-note">{t("countryHelp")}</p>
        </section>
        {saveError && <p role="alert">{t("saveFailed")}</p>}
        <button
          type="submit"
          className={"primary " + styles.save}
          disabled={pending || locating}
          aria-busy={pending}
        >
          {t("save")}
        </button>
        <Link
          href={localeDestination(returnTo, preference.locale)}
          className={styles.cancel}
          onClick={cancel}
        >
          {t("cancel")}
        </Link>
      </form>
    </main>
  );
}
