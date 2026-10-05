"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { AccountPage } from "../account/forms";
import s from "../account-privacy/privacy.module.css";
import formStyle from "./settings.module.css";
import { copy, obligationLabels } from "./copy";
import {
  obligationNames,
  type BrowseScope,
  type ClosureCode,
  type ClosurePolicy,
  type Locale,
  type PlanSummary,
  type SessionSummary,
} from "./model";
import type { SettingsMode } from "./actions";
import { useAccountSettings } from "./use-settings";
const stateLabels = {
  en: {
    reviewed: "Ready for confirmation",
    accepted: "Accepted",
    processing: "Processing",
    blocked: "Awaiting resolution",
    reconciling: "Checking an uncertain outcome",
    cancelled: "Cancelled",
    completed: "Completed",
    prepared: "Prepared",
    attempting: "In progress",
    unknown: "Unknown outcome",
    confirmed: "Confirmed",
  },
  bg: {
    reviewed: "Готово за потвърждение",
    accepted: "Прието",
    processing: "Обработка",
    blocked: "Очаква разрешаване",
    reconciling: "Проверка на неизвестен резултат",
    cancelled: "Отказано",
    completed: "Завършено",
    prepared: "Подготвено",
    attempting: "В процес",
    unknown: "Неизвестен резултат",
    confirmed: "Потвърдено",
  },
};
const categoryLabels = {
  en: {
    profile: "Personal seller profile",
    library: "Saved items and follows",
    cart: "Shopping cart",
    searches: "Saved searches",
    assistantMedia: "Assistant criteria, input and private media",
    personalMedia: "Personal listing media",
    identity: "Identity provider account",
    commerceEvidence: "Order and payment evidence",
    businessEvidence: "Business records",
    caseEvidence: "Case evidence",
  },
  bg: {
    profile: "Профил на личния продавач",
    library: "Запазени и следвани",
    cart: "Количка",
    searches: "Запазени търсения",
    assistantMedia: "Критерии, въведени данни и лична медия за асистента",
    personalMedia: "Медия за лични обяви",
    identity: "Профил при доставчика на идентификация",
    commerceEvidence: "Доказателства за поръчки и плащания",
    businessEvidence: "Бизнес записи",
    caseEvidence: "Доказателства по случаи",
  },
};
const effectLabels = {
  en: {
    "session.revoke": "End sessions",
    "identity.delete": "Remove identity account",
    "media.delete": "Remove private media",
    "billing.stop-renewal": "Stop personal subscription renewal",
    "data.remove": "Remove optional account data",
  },
  bg: {
    "session.revoke": "Прекратяване на сесии",
    "identity.delete": "Премахване на профила за идентификация",
    "media.delete": "Премахване на лична медия",
    "billing.stop-renewal": "Спиране на подновяването на личния абонамент",
    "data.remove": "Премахване на незадължителни данни",
  },
};
const assistantInputNotice = {
  en: "This category covers your current assistant criteria and input, Gift Finder and Compatibility briefs and results, unaccepted personal listing suggestions, and private assistant media. Accepted orders and drafts, their evidence and business data are retained.",
  bg: "Тази категория обхваща текущите Ви критерии и въведени данни за асистента, заданията и резултатите за подаръци и съвместимост, неприетите предложения за лични обяви и личната медия за асистента. Приетите поръчки и чернови, доказателствата за тях и бизнес данните се запазват.",
};
function errorText(code: ClosureCode | "STORAGE", locale: Locale) {
  const t = copy[locale];
  return code === "RECENT_AUTH_REQUIRED"
    ? t.recent
    : code === "CONFLICT"
      ? t.conflict
      : code === "OBLIGATIONS_HELD"
        ? t.held
        : code === "IRREVERSIBLE"
          ? t.irreversible
          : code === "UNKNOWN_OUTCOME"
            ? t.unknown
            : code === "STORAGE"
              ? t.storage
              : code === "EXPIRED"
                ? t.expired
                : code === "FORBIDDEN" || code === "UNAUTHENTICATED"
                  ? t.forbidden
                  : code === "POLICY_REQUIRED" || code === "BINDING_REQUIRED"
                    ? t.policyMissing
                    : t.unavailable;
}
function Policy({ value, locale }: { value: ClosurePolicy; locale: Locale }) {
  const t = copy[locale];
  return (
    <>
      <p>{value.summary[locale]}</p>
      {value.rules.map((rule) => (
        <div className={s.card} key={rule.category}>
          <h3>{categoryLabels[locale][rule.category]}</h3>
          <p>{rule.handling === "retain" ? t.retained : t.removed}</p>
          {rule.category === "assistantMedia" && (
            <p>{assistantInputNotice[locale]}</p>
          )}
          <p>
            {t.purpose}: {rule.purpose[locale]}
          </p>
          <p>
            {t.deadline}: {rule.explanation[locale]}
          </p>
        </div>
      ))}
    </>
  );
}
function PreferenceForm({
  saved,
  locale,
  disabled,
  onSave,
}: {
  saved: { locale: Locale; browseScope: BrowseScope } | null;
  locale: Locale;
  disabled: boolean;
  onSave: (locale: Locale, scope: BrowseScope) => void;
}) {
  const [language, setLanguage] = useState(saved?.locale ?? locale),
    [scope, setScope] = useState<BrowseScope>(saved?.browseScope ?? "all"),
    t = copy[locale];
  return (
    <form
      className={formStyle.form}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(language, scope);
      }}
    >
      <fieldset className={s.choices} disabled={disabled}>
        <label>
          {t.language}
          <select
            aria-label={t.language}
            value={language}
            onChange={(event) => {
              if (event.target.value === "bg" || event.target.value === "en")
                setLanguage(event.target.value);
            }}
          >
            <option value="bg">{t.bg}</option>
            <option value="en">{t.en}</option>
          </select>
        </label>
        <label>
          {t.scope}
          <select
            aria-label={t.scope}
            value={scope}
            onChange={(event) => {
              if (
                event.target.value === "all" ||
                event.target.value === "personal" ||
                event.target.value === "business"
              )
                setScope(event.target.value);
            }}
          >
            <option value="all">{t.all}</option>
            <option value="personal">{t.personal}</option>
            <option value="business">{t.business}</option>
          </select>
        </label>
        <button type="submit">{t.save}</button>
      </fieldset>
    </form>
  );
}
function PlanControl({
  plan,
  locale,
  disabled,
  confirmationAvailable,
  confirm,
  cancel,
  recheck,
}: {
  plan: PlanSummary;
  locale: Locale;
  disabled: boolean;
  confirmationAvailable: boolean;
  confirm: () => void;
  cancel: () => void;
  recheck: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false),
    t = copy[locale];
  return (
    <article className={s.card}>
      <h2>
        {t.state}: {stateLabels[locale][plan.state]}
      </h2>
      <Policy value={plan.policy} locale={locale} />
      {plan.state === "reviewed" && plan.reviewExpired && <p>{t.expired}</p>}
      {plan.state === "reviewed" && (
        <>
          <label className={s.acknowledge}>
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={
                disabled || !confirmationAvailable || plan.reviewExpired
              }
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            {t.ack}
          </label>
          <div className={s.controls}>
            <button
              disabled={
                disabled ||
                !acknowledged ||
                !confirmationAvailable ||
                plan.reviewExpired
              }
              onClick={confirm}
            >
              {t.confirm}
            </button>
          </div>
        </>
      )}
      <div className={s.controls}>
        {plan.cancellable && (
          <button disabled={disabled} onClick={cancel}>
            {t.cancel}
          </button>
        )}
        {!["reviewed", "cancelled", "completed"].includes(plan.state) && (
          <button disabled={disabled} onClick={recheck}>
            {t.recheck}
          </button>
        )}
      </div>
      <ul>
        {plan.effects.map((effect) => (
          <li key={effect.kind + effect.state}>
            {effectLabels[locale][effect.kind]}: {effect.count} —{" "}
            {stateLabels[locale][effect.state]}
          </li>
        ))}
      </ul>
    </article>
  );
}
function SessionControl({
  session,
  index,
  locale,
  disabled,
  end,
}: {
  session: SessionSummary;
  index: number;
  locale: Locale;
  disabled: boolean;
  end: () => void;
}) {
  const [ack, setAck] = useState(false),
    t = copy[locale];
  return (
    <div className={s.card}>
      <h3>
        {session.current
          ? t.current
          : (locale === "bg" ? "Сесия " : "Session ") + (index + 1)}
      </h3>
      <p>
        <time dateTime={session.lastActiveAt}>
          {new Date(session.lastActiveAt).toLocaleString(locale, {
            timeZone: "Europe/Sofia",
          })}
        </time>
      </p>
      <label className={s.acknowledge}>
        <input
          type="checkbox"
          disabled={disabled}
          checked={ack}
          onChange={(event) => setAck(event.target.checked)}
        />
        {t.end}
      </label>
      <div className={s.controls}>
        <button disabled={disabled || !ack} onClick={end}>
          {t.end}
        </button>
      </div>
    </div>
  );
}
function CurrentSettings({
  subject,
  mode,
  locale,
}: {
  subject: string;
  mode: SettingsMode;
  locale: Locale;
}) {
  const state = useAccountSettings(subject, mode),
    t = copy[locale],
    view = state.view,
    current = view && ("preferences" in view ? view.preferences : view.closure),
    disabled = state.busy || !state.ready || state.pending !== null;
  const closure = view && "closure" in view ? view.closure : null;
  const facts = closure?.obligations ?? null;
  const factsClear =
    facts !== null && obligationNames.every((name) => facts[name] === 0);
  const saved =
    view && "preferences" in view ? view.preferences.preferences : null;
  const href = saved
    ? "/search?" +
      new URLSearchParams({
        lang: saved.locale,
        ...(saved.browseScope === "all" ? {} : { seller: saved.browseScope }),
      }).toString()
    : null;
  return (
    <AccountPage title={t[mode]}>
      <main className={s.content}>
        <p>
          {mode === "closure"
            ? t.intro
            : mode === "security"
              ? t.sessionNotice
              : t.preferenceNotice}
        </p>
        <div className={s.controls}>
          <button
            disabled={state.busy}
            onClick={() => void state.refresh(true)}
          >
            {state.error === "RECENT_AUTH_REQUIRED" ? t.recent : t.refresh}
          </button>
          <Link
            className={s.download}
            href={"/account/privacy/data?lang=" + locale}
          >
            {t.data}
          </Link>
        </div>
        {state.error && (
          <p className={s.feedback} role="alert">
            {errorText(state.error, locale)}
          </p>
        )}
        {!state.ready && !state.error && <p role="status">{t.checking}</p>}
        {state.pending && (
          <section>
            <p>{t.pending}</p>
            <div className={s.controls}>
              <button
                disabled={state.busy || !state.ready}
                onClick={state.recover}
              >
                {t.recover}
              </button>
              <button
                disabled={state.busy || !state.ready}
                onClick={state.retry}
              >
                {t.retry}
              </button>
            </div>
          </section>
        )}
        {mode === "preferences" && current && (
          <section>
            <PreferenceForm
              key={current.revision}
              saved={saved}
              locale={locale}
              disabled={disabled}
              onSave={(language, browseScope) =>
                state.execute({
                  kind: "preferences",
                  locale: language,
                  browseScope,
                })
              }
            />
            {href && (
              <>
                <p role="status">{t.saved}</p>
                <Link className={s.download} href={href}>
                  {t.search}
                </Link>
              </>
            )}
          </section>
        )}
        {mode === "security" && closure && (
          <section>
            {!closure.securityAvailable && <p>{t.unavailable}</p>}
            {closure.sessionsLimited && <p>{t.limited}</p>}
            {closure.sessions.map((session, index) => (
              <SessionControl
                key={session.ref}
                session={session}
                index={index}
                locale={locale}
                disabled={disabled || !closure.securityAvailable}
                end={() =>
                  state.execute({
                    kind: "revokeSession",
                    sessionRef: session.ref,
                    acknowledged: true,
                  })
                }
              />
            ))}
            {closure.securityEffects.map((effect) => (
              <div className={s.card} key={effect.id}>
                <p>
                  {t.state}: {stateLabels[locale][effect.state]}
                </p>
                {effect.state !== "confirmed" && (
                  <button
                    disabled={disabled}
                    onClick={() => void state.checkSession(effect.id)}
                  >
                    {t.recheck}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}
        {mode === "closure" && closure && (
          <>
            <p>
              {t.state}: {t[closure.lifecycle]}
            </p>
            <section>
              {!closure.executionAvailable &&
                closure.lifecycle === "active" &&
                facts && <p>{factsClear ? t.policyMissing : t.held}</p>}
              {closure.policy && (
                <Policy value={closure.policy.value} locale={locale} />
              )}
              <h2>{t.holds}</h2>
              {!facts && closure.lifecycle !== "closed" && (
                <p>{t.unavailable}</p>
              )}
              {facts && (
                <dl className={s.facts}>
                  {obligationNames.map((name) => (
                    <div key={name} style={{ display: "contents" }}>
                      <dt>{obligationLabels[locale][name]}</dt>
                      <dd>{facts[name]}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {!closure.requestedClosures.length && <p>{t.request}</p>}
              {closure.requestedClosures.map((id) => (
                <div className={s.controls} key={id}>
                  <button
                    disabled={disabled || !closure.executionAvailable}
                    onClick={() => {
                      if (closure.policy)
                        state.execute({
                          kind: "review",
                          closureRequestId: id,
                          policyId: closure.policy.id,
                        });
                    }}
                  >
                    {t.review}
                  </button>
                </div>
              ))}
            </section>
            {closure.plans.map((plan) => (
              <PlanControl
                key={plan.id}
                plan={plan}
                locale={locale}
                disabled={disabled}
                confirmationAvailable={closure.executionAvailable && factsClear}
                confirm={() =>
                  state.execute({
                    kind: "confirm",
                    planId: plan.id,
                    planHash: plan.hash,
                    acknowledged: true,
                  })
                }
                cancel={() =>
                  state.execute({ kind: "cancel", planId: plan.id })
                }
                recheck={() =>
                  state.execute({ kind: "recheck", planId: plan.id })
                }
              />
            ))}
            {closure.historyLimited && <p>{t.history}</p>}
          </>
        )}
      </main>
    </AccountPage>
  );
}
export function AccountSettingsUnavailable({
  mode,
  locale,
}: {
  mode: SettingsMode;
  locale: Locale;
}) {
  return (
    <AccountPage title={copy[locale][mode]}>
      <main className={s.content}>
        <p>{copy[locale].unavailable}</p>
      </main>
    </AccountPage>
  );
}
export function AccountSettingsManager({
  mode,
  locale,
}: {
  mode: SettingsMode;
  locale: Locale;
}) {
  const auth = useAuth();
  if (!auth.isLoaded)
    return (
      <AccountPage title={copy[locale][mode]}>
        <main className={s.content}>
          <p>{copy[locale].checking}</p>
        </main>
      </AccountPage>
    );
  if (!auth.isSignedIn || !auth.userId)
    return (
      <AccountPage title={copy[locale][mode]}>
        <main className={s.content}>
          <p>{copy[locale].forbidden}</p>
          <Link
            className={s.download}
            href={
              "/sign-in?returnTo=" +
              encodeURIComponent("/account/privacy/" + mode + "?lang=" + locale)
            }
          >
            {copy[locale].signIn}
          </Link>
        </main>
      </AccountPage>
    );
  return (
    <CurrentSettings
      key={auth.userId + ":" + mode}
      subject={auth.userId}
      mode={mode}
      locale={locale}
    />
  );
}
