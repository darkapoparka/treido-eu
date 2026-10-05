"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AccountPage } from "../account/forms";
import {
  EXPORT_CATEGORIES,
  type ClosureFacts,
  type ClosureReview,
  type PrivacyCode,
  type PrivacyOperation,
} from "./model";
import { privacyCopy } from "./copy";
import { usePrivacy } from "./use-privacy";
import s from "./privacy.module.css";
type Locale = "bg" | "en";
function codeText(code: PrivacyCode | "STORAGE", locale: Locale) {
  const t = privacyCopy[locale];
  return code === "RECENT_AUTH_REQUIRED"
    ? t.recent
    : code === "CONFLICT"
      ? t.stale
      : code === "EXPIRED"
        ? t.expired
        : code === "QUOTA_EXCEEDED"
          ? t.quota
          : code === "INVALID_INPUT"
            ? t.invalid
            : code === "UNAUTHENTICATED" || code === "FORBIDDEN"
              ? t.forbidden
              : code === "STORAGE"
                ? t.storage
                : t.unavailable;
}
function Facts({ facts, locale }: { facts: ClosureFacts; locale: Locale }) {
  return (
    <dl className={s.facts}>
      {(Object.keys(privacyCopy[locale].facts) as (keyof ClosureFacts)[]).map(
        (key) => (
          <div key={key} style={{ display: "contents" }}>
            <dt>{privacyCopy[locale].facts[key]}</dt>
            <dd>{facts[key]}</dd>
          </div>
        ),
      )}
    </dl>
  );
}
function Stamp({
  value,
  label,
  locale,
}: {
  value: string;
  label: string;
  locale: Locale;
}) {
  return (
    <p className={s.stamp}>
      {label}:{" "}
      <time dateTime={value}>
        {new Date(value).toLocaleString(locale, { timeZone: "Europe/Sofia" })}
      </time>
    </p>
  );
}
function ReviewControl({
  review,
  locale,
  disabled,
  execute,
}: {
  review: ClosureReview;
  locale: Locale;
  disabled: boolean;
  execute: (op: PrivacyOperation) => Promise<void>;
}) {
  const [acknowledged, setAcknowledged] = useState(false),
    t = privacyCopy[locale];
  return (
    <article className={s.card}>
      <h3>{t.review}</h3>
      <Facts facts={review.facts} locale={locale} />
      <Stamp value={review.createdAt} label={t.checked} locale={locale} />
      <Stamp value={review.expiresAt} label={t.expires} locale={locale} />
      <p>{t.pendingEffects}</p>
      <p>{t.newReview}</p>
      <label className={s.acknowledge}>
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={disabled}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <span>{t.acknowledge}</span>
      </label>
      <div className={s.controls}>
        <button
          disabled={disabled || !acknowledged}
          onClick={() =>
            void execute({
              kind: "submit",
              reviewId: review.id,
              acknowledged: true,
            })
          }
        >
          {t.submit}
        </button>
      </div>
    </article>
  );
}
export function PrivacyUnavailable({
  locale,
  invalid = false,
}: {
  locale: Locale;
  invalid?: boolean;
}) {
  const router = useRouter(),
    t = privacyCopy[locale];
  return (
    <AccountPage title={t.title} dock={false}>
      <main className={s.content}>
        <p role="alert">{invalid ? t.invalid : t.unavailable}</p>
        <div className={s.controls}>
          <button onClick={() => router.refresh()}>{t.refresh}</button>
          <Link href={"/minis?lang=" + locale}>{t.back}</Link>
        </div>
      </main>
    </AccountPage>
  );
}
function SignedInPrivacy({
  subject,
  locale,
}: {
  subject: string;
  locale: Locale;
}) {
  const controller = usePrivacy(subject),
    t = privacyCopy[locale],
    view = controller.view;
  const [categories, setCategories] = useState(new Set(EXPORT_CATEGORIES));
  const disabled = controller.busy || !!controller.pending || !view;
  const pendingClosure =
    view?.closures.some((request) => request.state === "requested") ?? false;
  return (
    <AccountPage title={t.title} dock={false}>
      <main className={s.content}>
        <p>{t.intro}</p>
        <div className={s.controls}>
          <button
            disabled={controller.busy}
            onClick={() => void controller.refresh()}
          >
            {t.refresh}
          </button>
          <Link href={"/minis?lang=" + locale}>{t.back}</Link>
        </div>
        {controller.busy && <p role="status">{t.busy}</p>}
        <nav className={s.controls} aria-label={t.title}>
          <Link href={"/account/privacy/preferences?lang=" + locale}>
            {t.preferencesLink}
          </Link>
          <Link href={"/account/privacy/security?lang=" + locale}>
            {t.securityLink}
          </Link>
          <Link href={"/account/privacy/closure?lang=" + locale}>
            {t.closureLink}
          </Link>
        </nav>
        {controller.code && (
          <p className={s.feedback} role="alert">
            {codeText(controller.code, locale)}
          </p>
        )}
        {controller.pending && (
          <div className={s.feedback}>
            <p role="status">{t.pending}</p>
            <button
              disabled={controller.busy || !view}
              onClick={() => void controller.execute()}
            >
              {t.retry}
            </button>
          </div>
        )}
        {controller.acknowledgment && (
          <p className={s.feedback} role="status">
            {t.ready} · {controller.acknowledgment.revision}
          </p>
        )}
        {view && (
          <>
            {view.registrationNeeded && (
              <p className={s.feedback}>{t.registration}</p>
            )}
            <Stamp label={t.checked} value={view.checkedAt} locale={locale} />
            <section aria-labelledby="privacy-export-title">
              <h2 id="privacy-export-title">{t.data}</h2>
              <p>{t.scope}</p>
              <p>{t.exclusions}</p>
              <p>{t.expiry}</p>
              <fieldset className={s.choices} disabled={disabled}>
                <legend>{t.data}</legend>
                {EXPORT_CATEGORIES.map((category) => (
                  <label key={category}>
                    <input
                      type="checkbox"
                      checked={categories.has(category)}
                      onChange={(event) =>
                        setCategories((previous) => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(category);
                          else next.delete(category);
                          return next;
                        })
                      }
                    />
                    <span>{t.categories[category]}</span>
                  </label>
                ))}
              </fieldset>
              <button
                disabled={disabled || !categories.size}
                onClick={() =>
                  void controller.execute({
                    kind: "export",
                    categories: EXPORT_CATEGORIES.filter((category) =>
                      categories.has(category),
                    ),
                  })
                }
              >
                {t.export}
              </button>
              {!view.exports.length && <p>{t.emptyExports}</p>}
              {view.exports.map((item) => (
                <article className={s.card} key={item.id}>
                  <p>
                    {item.categories
                      .map((category) => t.categories[category])
                      .join(" · ")}
                  </p>
                  <Stamp
                    value={item.createdAt}
                    label={t.checked}
                    locale={locale}
                  />
                  <Stamp
                    value={item.expiresAt}
                    label={t.expires}
                    locale={locale}
                  />
                  <div className={s.controls}>
                    {item.downloadable && !controller.pending && (
                      <button
                        className={s.download}
                        disabled={disabled}
                        onClick={() => void controller.download(item.id)}
                      >
                        {t.download}
                      </button>
                    )}
                    <button
                      disabled={disabled}
                      onClick={() =>
                        void controller.execute({
                          kind: "discard",
                          exportId: item.id,
                        })
                      }
                    >
                      {t.discard}
                    </button>
                  </div>
                </article>
              ))}
              <p>{t.limited}</p>
            </section>
            <section aria-labelledby="privacy-closure-title">
              <h2 id="privacy-closure-title">{t.closure}</h2>
              <p>{t.pendingEffects}</p>
              <h3>{t.retention}</h3>
              <ul>
                {t.retentionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>{t.noDuration}</p>
              <h3>{t.obligations}</h3>
              {view.facts && <Facts facts={view.facts} locale={locale} />}
              <p>{t.factsNote}</p>
              <button
                disabled={disabled || pendingClosure}
                onClick={() => void controller.execute({ kind: "review" })}
              >
                {t.prepare}
              </button>
              {view.reviews[0] && !pendingClosure && (
                <ReviewControl
                  key={view.actorKey + view.reviews[0].id + view.revision}
                  review={view.reviews[0]}
                  locale={locale}
                  disabled={disabled}
                  execute={controller.execute}
                />
              )}
              {!view.closures.length && <p>{t.noClosure}</p>}
              {view.closures.map((request) => (
                <article className={s.card} key={request.id}>
                  <h3>
                    {request.state === "requested" ? t.requested : t.withdrawn}
                  </h3>
                  <Stamp
                    value={request.updatedAt}
                    label={t.checked}
                    locale={locale}
                  />
                  <p className={s.stamp}>{request.id}</p>
                  {request.state === "requested" && (
                    <button
                      disabled={disabled}
                      onClick={() =>
                        void controller.execute({
                          kind: "withdraw",
                          closureId: request.id,
                        })
                      }
                    >
                      {t.withdraw}
                    </button>
                  )}
                </article>
              ))}
            </section>
            {view.historyLimited && <p>{t.limited}</p>}
          </>
        )}
      </main>
    </AccountPage>
  );
}
export function PrivacyManager() {
  const { isLoaded, isSignedIn, user } = useUser(),
    locale: Locale = useLocale() === "en" ? "en" : "bg",
    t = privacyCopy[locale];
  if (!isLoaded)
    return (
      <AccountPage title={t.title} dock={false}>
        <main className={s.content}>
          <p role="status">{t.busy}</p>
        </main>
      </AccountPage>
    );
  if (!isSignedIn || !user)
    return (
      <AccountPage title={t.title} dock={false}>
        <main className={s.content}>
          <p>{t.signInNote}</p>
          <Link
            href={
              "/sign-in?lang=" +
              locale +
              "&returnTo=" +
              encodeURIComponent("/account/privacy/data?lang=" + locale)
            }
          >
            {t.signIn}
          </Link>
        </main>
      </AccountPage>
    );
  return <SignedInPrivacy key={user.id} subject={user.id} locale={locale} />;
}
