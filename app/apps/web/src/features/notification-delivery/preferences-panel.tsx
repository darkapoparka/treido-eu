"use client";
import type { ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AccountPage } from "../account/forms";
import { SourceLink } from "../discovery/return-navigation";
import type { NotificationPreferenceView } from "./model";
import { notificationPreferencesCopy } from "./preferences-copy";
import { useNotificationPreferences } from "./use-preferences";

type Language = "bg" | "en";
function Frame({
  language,
  view,
  disabled = true,
  change,
  children,
}: {
  language: Language;
  view: NotificationPreferenceView | null;
  disabled?: boolean;
  change?: (settings: NotificationPreferenceView["settings"]) => void;
  children: ReactNode;
}) {
  const t = notificationPreferencesCopy[language],
    canEnable = view?.recipient === "ready" && view.deliveryAvailable;
  return (
    <AccountPage
      title={t.title}
      dockFade
      className="account-settings-page notification-settings-page"
      publicData
    >
      <p className="form-note">{t.intro}</p>
      {children}
      {(
        [
          ["savedSearchEmail", t.savedSearch, t.savedSearchNote],
          ["messageEmail", t.messages, t.messagesNote],
        ] as const
      ).map(([key, title, note]) => (
        <label className="notification-setting" key={key}>
          <span>
            {title}
            <small id={`notification-${key}-note`}>{note}</small>
          </span>
          <input
            role="switch"
            type="checkbox"
            name={key}
            aria-describedby={`notification-${key}-note`}
            checked={view?.settings[key] ?? false}
            disabled={disabled || (!view?.settings[key] && !canEnable)}
            onChange={(event) => {
              if (view)
                change?.({ ...view.settings, [key]: event.target.checked });
            }}
          />
        </label>
      ))}
      <label className="notification-setting">
        <span>
          {t.push}
          <small>{t.pushNote}</small>
        </span>
        <input role="switch" type="checkbox" checked={false} disabled />
      </label>
      <SourceLink
        className="primary form-submit"
        href={`/notifications?lang=${language}`}
      >
        {t.title}
      </SourceLink>
    </AccountPage>
  );
}
function SignedInPreferences({
  subject,
  language,
}: {
  subject: string;
  language: Language;
}) {
  const controller = useNotificationPreferences(subject, language),
    t = notificationPreferencesCopy[language],
    view = controller.view;
  const error =
    controller.error === "STORAGE"
      ? t.storage
      : controller.error === "UNAUTHENTICATED" ||
          controller.error === "FORBIDDEN"
        ? t.denied
        : controller.error === "CONFLICT"
          ? t.conflict
          : controller.error === "NOT_FOUND"
            ? t.registration
            : controller.error === "INVALID_INPUT"
              ? t.invalid
              : controller.error
                ? t.unavailable
                : null;
  return (
    <Frame
      language={language}
      view={view}
      disabled={
        !view ||
        controller.busy ||
        !!controller.pending ||
        controller.error === "STORAGE"
      }
      change={(settings) => void controller.change(settings)}
    >
      {controller.busy && (
        <p className="form-note" role="status">
          {controller.pending ? t.saving : t.checking}
        </p>
      )}
      {!view && !controller.busy && !error && (
        <p className="form-note" role="status">
          {t.checking}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {controller.error === "NOT_FOUND" && (
        <SourceLink
          className="primary form-submit"
          href={`/app/intent?lang=${language}`}
        >
          {t.registrationAction}
        </SourceLink>
      )}
      {view && (
        <p className="form-note" role="status">
          {view.recipient === "ready"
            ? t.recipientReady
            : view.recipient === "missing"
              ? t.recipientMissing
              : t.recipientUnavailable}
        </p>
      )}
      {view && !view.deliveryAvailable && (
        <p className="form-note">{t.deliveryUnavailable}</p>
      )}
      {view?.recipient === "missing" && (
        <SourceLink href={`/account/security?lang=${language}`}>
          {t.security}
        </SourceLink>
      )}
      {controller.saved && (
        <p className="form-note" role="status">
          {t.saved}
        </p>
      )}
      {controller.pending && (
        <p className="form-note" role="status">
          {t.pending}
        </p>
      )}
      {controller.pending && (
        <button
          className="primary form-submit"
          disabled={!view || controller.busy}
          onClick={() => void controller.change()}
        >
          {t.retry}
        </button>
      )}
      {(error || !view || controller.pending) && (
        <button
          className="primary form-submit"
          disabled={controller.busy}
          onClick={() => void controller.refresh()}
        >
          {t.refresh}
        </button>
      )}
    </Frame>
  );
}
function CurrentPreferences({
  actorSubject,
  language,
}: {
  actorSubject: string;
  language: Language;
}) {
  const { isLoaded, isSignedIn, user } = useUser(),
    t = notificationPreferencesCopy[language];
  if (!isLoaded || !isSignedIn || user?.id !== actorSubject)
    return (
      <Frame language={language} view={null}>
        <p className="form-note" role="status">
          {isLoaded ? t.denied : t.checking}
        </p>
      </Frame>
    );
  return (
    <SignedInPreferences
      key={actorSubject}
      subject={actorSubject}
      language={language}
    />
  );
}
export function NotificationPreferencesPanel({
  language,
  state,
  actorSubject,
}: {
  language: Language;
  state: "ready" | "signed-out" | "unavailable";
  actorSubject?: string;
}) {
  const router = useRouter(),
    t = notificationPreferencesCopy[language];
  if (state === "ready" && actorSubject)
    return (
      <CurrentPreferences actorSubject={actorSubject} language={language} />
    );
  return (
    <Frame language={language} view={null}>
      <p className="form-note" role="status">
        {state === "signed-out" ? t.signInNote : t.unavailable}
      </p>
      {state === "signed-out" ? (
        <SourceLink
          className="primary form-submit"
          href={`/sign-in?lang=${language}&returnTo=${encodeURIComponent(`/account/notifications?lang=${language}`)}`}
        >
          {t.signIn}
        </SourceLink>
      ) : (
        <button
          className="primary form-submit"
          onClick={() => router.refresh()}
        >
          {t.refresh}
        </button>
      )}
    </Frame>
  );
}
