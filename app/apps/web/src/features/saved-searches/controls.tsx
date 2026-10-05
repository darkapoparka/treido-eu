"use client";
import { useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { getCategory, getCategoryLabel } from "@treido/contracts/categories";
import { SourceLink } from "../discovery/return-navigation";
import { optionLabel } from "../selling/copy";
import { formatAttribute } from "../shopping-tools/tool-ui";
import { money } from "../shopping-tools/copy";
import {
  toolHref,
  type ToolIntent,
  type ToolMode,
} from "../shopping-tools/intent";
import { reviewedCriteria, savedSearchHref, SEARCH_LIMITS } from "./model";
import { searchCopy } from "./copy";
import { useSavedSearches } from "./provider";
import s from "../shopping-tools/tools.module.css";
import c from "./searches.module.css";
export function useSearchLocale() {
  return useLocale() === "en" ? "en" : "bg";
}
export function SearchFeedback({ returnTo }: { returnTo?: string }) {
  const controller = useSavedSearches(),
    locale = useSearchLocale(),
    t = searchCopy[locale],
    path = usePathname(),
    params = useSearchParams();
  if (controller.status === "guest")
    return (
      <p className={s.note}>
        <SourceLink
          preserveDiscoveryContext={false}
          href={
            "/sign-in?lang=" +
            locale +
            "&returnTo=" +
            encodeURIComponent(returnTo ?? path + "?" + params)
          }
        >
          {t.guest}
        </SourceLink>{" "}
        · {t.noAutomatic}
      </p>
    );
  return (
    <div aria-live="polite" className={s.feedback}>
      {controller.status === "checking" && <p role="status">{t.checking}</p>}
      {(controller.status === "unavailable" ||
        controller.status === "denied") && (
        <p role="alert">
          {controller.status === "denied" ? t.denied : t.storageUnavailable}
        </p>
      )}
      {controller.feedback && <p role="status">{t[controller.feedback]}</p>}
      {controller.pending && (
        <>
          <p>{t.pending}</p>
          <button
            className={s.button}
            disabled={controller.busy}
            onClick={() => void controller.retry()}
          >
            {controller.busy ? t.saving : t.retryOriginal}
          </button>
        </>
      )}
      {!controller.pending && (
        <button
          className={s.button}
          disabled={controller.busy}
          onClick={() => void controller.reload()}
        >
          {t.retry}
        </button>
      )}
      {controller.ack && (
        <p>
          {controller.ack.replayed ? t.replayed : t.saved} · {t.revision}:{" "}
          {controller.ack.revision}
          {controller.view && (
            <>
              {" "}
              · {t.currentRevision}: {controller.view.revision}
            </>
          )}
        </p>
      )}
      {controller.ack?.searchId && (
        <SourceLink
          preserveDiscoveryContext={false}
          href={savedSearchHref(locale, controller.ack.searchId)}
        >
          {t.manage}
        </SourceLink>
      )}
    </div>
  );
}
export function CriteriaSummary({ intent }: { intent: ToolIntent }) {
  const locale = useSearchLocale(),
    t = searchCopy[locale],
    d = intent.discovery,
    category = d.category ? getCategory(d.category) : null;
  return (
    <dl className={s.factList}>
      <dt>{t.query}</dt>
      <dd>{d.q || t.unknown}</dd>
      <dt>{t.seller}</dt>
      <dd>{t[d.seller]}</dd>
      <dt>{t.category}</dt>
      <dd>{d.category ? getCategoryLabel(d.category, locale) : t.any}</dd>
      <dt>{t.condition}</dt>
      <dd>{d.condition ? optionLabel(d.condition, locale) : t.any}</dd>
      <dt>{t.location}</dt>
      <dd>{d.location || t.any}</dd>
      <dt>{t.budget}</dt>
      <dd>
        {d.minPriceMinor === null ? t.any : money(d.minPriceMinor, locale)} –{" "}
        {d.maxPriceMinor === null ? t.any : money(d.maxPriceMinor, locale)}
      </dd>
      <dt>{t.handover}</dt>
      <dd>{t[intent.handover]}</dd>
      <dt>{t.availability}</dt>
      <dd>{t[intent.availability]}</dd>
      {Object.entries(d.attributes).map(([key, value]) => (
        <div key={key} className={s.wide}>
          <dt>
            {category?.kind === "leaf"
              ? (category.profile.fields.find((f) => f.id === key)?.labels[
                  locale
                ] ?? key)
              : key}
          </dt>
          <dd>{formatAttribute(value, locale)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function FrequencyControl({
  value,
  onChange,
  disabled,
}: {
  value: 60 | 1440;
  onChange: (value: 60 | 1440) => void;
  disabled?: boolean;
}) {
  const t = searchCopy[useSearchLocale()];
  return (
    <label className={s.field}>
      {t.frequency}
      <select
        disabled={disabled}
        value={value}
        onChange={(event) =>
          onChange(event.target.value === "1440" ? 1440 : 60)
        }
      >
        <option value="60">{t.hourly}</option>
        <option value="1440">{t.daily}</option>
      </select>
    </label>
  );
}
export function SaveSearchControl({
  intent,
  mode,
}: {
  intent: ToolIntent;
  mode: ToolMode;
}) {
  const controller = useSavedSearches(),
    locale = useSearchLocale(),
    t = searchCopy[locale],
    enabled =
      controller.status === "ready" && !controller.busy && !controller.pending;
  const [frequency, setFrequency] = useState<60 | 1440>(60);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void controller.execute({
      kind: "save",
      name: String(data.get("name") ?? ""),
      criteria: reviewedCriteria(intent, mode),
      enable: data.get("enable") === "on",
      frequency,
    });
  };
  return (
    <details className={s.filter}>
      <summary>{t.save}</summary>
      <p>{t.consentNote}</p>
      <CriteriaSummary intent={intent} />
      <form onSubmit={submit} className={s.stack}>
        <label className={s.field}>
          {t.name}
          <input
            name="name"
            required
            maxLength={SEARCH_LIMITS.name}
            disabled={!enabled}
            defaultValue={(
              intent.discovery.q || t[mode === "deal-finder" ? "deal" : "find"]
            ).slice(0, SEARCH_LIMITS.name)}
          />
        </label>
        <FrequencyControl
          value={frequency}
          onChange={setFrequency}
          disabled={!enabled}
        />
        <label className={c.consent}>
          <input type="checkbox" name="enable" disabled={!enabled} />
          <span>{t.enableConsent}</span>
        </label>
        <p className={s.note}>{t.cadenceNote}</p>
        <button className={s.button + " " + s.primary} disabled={!enabled}>
          {controller.busy ? t.saving : t.save}
        </button>
      </form>
      <SearchFeedback returnTo={toolHref(mode, intent)} />
      <SourceLink
        preserveDiscoveryContext={false}
        href={savedSearchHref(locale)}
      >
        {t.manage}
      </SourceLink>
    </details>
  );
}
export function SearchManageLink() {
  const locale = useSearchLocale();
  return (
    <SourceLink preserveDiscoveryContext={false} href={savedSearchHref(locale)}>
      {searchCopy[locale].manage}
    </SourceLink>
  );
}
