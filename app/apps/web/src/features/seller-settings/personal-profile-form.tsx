"use client";
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useSettingsSession } from "./use-settings-session";
import { useUnsavedChanges } from "../sellers/use-unsaved-changes";
import {
  readPersonalProfileAction,
  savePersonalProfileAction,
} from "./personal-profile-actions";
import type {
  PersonalProfileCommand,
  PersonalProfileView,
} from "./personal-profile-model";
import a from "../sellers/admin.module.css";
import s from "../team/team.module.css";

export function PersonalProfileForm({
  initial,
  actorSubject,
  language,
}: {
  initial: PersonalProfileView;
  actorSubject: string;
  language: "bg" | "en";
}) {
  const t = useTranslations("sellerSettings");
  const load = useCallback(
    () => readPersonalProfileAction(initial.sellerId),
    [initial.sellerId],
  );
  const session = useSettingsSession<
    PersonalProfileView,
    PersonalProfileCommand
  >(initial, actorSubject, load, savePersonalProfileAction);
  const { data, status, pending, notice, latest, editKey } = session;
  const [editor, setEditor] = useState({
    key: null as string | null,
    profile: initial.profile,
    saved: initial,
  });
  const { profile, saved } = editor;
  const hidden = session.hidden || editor.key !== editKey;
  useUnsavedChanges(
    !hidden && JSON.stringify(profile) !== JSON.stringify(saved.profile),
    language,
  );
  if (!session.hidden && editor.key !== editKey) {
    setEditor({
      key: editKey,
      profile:
        (session.retained?.profile as PersonalProfileView["profile"]) ??
        data.profile,
      saved: session.retained
        ? { ...data, revision: session.retained.expectedRevision }
        : data,
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (hidden) return;
    await session.submit(
      {
        sellerId: initial.sellerId,
        expectedRevision: saved.revision,
        requestId: crypto.randomUUID(),
        profile,
      },
      (value) => {
        setEditor({ key: editKey, profile: value.profile, saved: value });
      },
    );
  }
  function applyLatest(replace: boolean) {
    if (!latest || hidden || pending || !session.clearAttempt()) return;
    setEditor({
      ...editor,
      profile: replace ? latest.profile : profile,
      saved: latest,
    });
  }
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("personalProfile")}</h1>
        <Link
          className={a.secondary}
          href={`/app/sellers/${initial.sellerId}/settings?lang=${language}`}
        >
          {t("back")}
        </Link>
      </header>
      <div className={a.pageBody}>
        {hidden && (
          <section className={s.card} role="status">
            <p>
              {t(
                session.denied
                  ? "profileDenied"
                  : status === "checking"
                    ? "checking"
                    : "unavailable",
              )}
            </p>
            <button className={a.secondary} onClick={session.refresh}>
              {t("retry")}
            </button>
          </section>
        )}
        {!hidden && (
          <div className={s.stack} data-personal-profile="true">
            <form className={s.card} onSubmit={submit}>
              <p>{t("personalProfileNote")}</p>
              <fieldset className={s.form} disabled={pending || hidden}>
                <label className={s.field}>
                  {t("profileName")}
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    value={profile.name}
                    readOnly={session.uncertain}
                    onChange={(e) => {
                      if (!session.edit()) return;
                      setEditor({
                        ...editor,
                        profile: { ...profile, name: e.target.value },
                      });
                    }}
                  />
                </label>
                <label className={s.field}>
                  {t("profileLocality")}
                  <input
                    name="locality"
                    maxLength={100}
                    value={profile.locality}
                    readOnly={session.uncertain}
                    onChange={(e) => {
                      if (!session.edit()) return;
                      setEditor({
                        ...editor,
                        profile: { ...profile, locality: e.target.value },
                      });
                    }}
                  />
                </label>
                <label className={s.field}>
                  {t("profileDescription")}
                  <textarea
                    name="description"
                    rows={5}
                    maxLength={1200}
                    value={profile.description}
                    readOnly={session.uncertain}
                    onChange={(e) => {
                      if (!session.edit()) return;
                      setEditor({
                        ...editor,
                        profile: { ...profile, description: e.target.value },
                      });
                    }}
                  />
                </label>
                <p className={s.muted}>{t("profilePrivacy")}</p>
                <div className={s.actions}>
                  <button className={a.primary}>
                    {t(pending ? "saving" : "saveProfile")}
                  </button>
                  <span className={s.muted}>
                    {t("revision", { revision: saved.revision })}
                  </span>
                </div>
              </fieldset>
            </form>
            {notice && (
              <p
                className={s.notice}
                role={notice === "SAVED" ? "status" : "alert"}
              >
                {t(
                  notice === "SAVED"
                    ? "profileSaved"
                    : notice === "CONFLICT"
                      ? "conflict"
                      : notice === "INVALID_INPUT"
                        ? "profileInvalid"
                        : "unavailable",
                )}
              </p>
            )}
            {(notice === "CONFLICT" || data.revision > saved.revision) && (
              <button
                className={a.secondary}
                disabled={pending}
                onClick={() => void session.compare()}
              >
                {t("compare")}
              </button>
            )}
            {latest && (
              <section className={s.card}>
                <h2>{t("latest")}</h2>
                <p>{t("revision", { revision: latest.revision })}</p>
                <dl>
                  <dt>{t("profileName")}</dt>
                  <dd className={s.compare}>{latest.profile.name}</dd>
                  <dt>{t("profileLocality")}</dt>
                  <dd className={s.compare}>
                    {latest.profile.locality || "—"}
                  </dd>
                  <dt>{t("profileDescription")}</dt>
                  <dd className={s.compare}>
                    {latest.profile.description || "—"}
                  </dd>
                </dl>
                <p>{t("replaceNote")}</p>
                <div className={s.actions}>
                  <button
                    className={a.secondary}
                    disabled={pending}
                    onClick={() => applyLatest(true)}
                  >
                    {t("load")}
                  </button>
                  <button
                    className={a.secondary}
                    disabled={pending}
                    onClick={() => applyLatest(false)}
                  >
                    {t("profileKeepInput")}
                  </button>
                </div>
              </section>
            )}
            <section className={s.card} aria-label={t("profilePreview")}>
              <h2>{t("profilePreview")}</h2>
              <p className={s.muted}>{t("profilePreviewNote")}</p>
              <h3>{profile.name || "—"}</h3>
              <p>{profile.locality}</p>
              <p className={s.compare}>{profile.description}</p>
              <p className={s.muted}>{t("storeAvailability")}</p>
              <Link
                className={a.secondary}
                href={`/stores/${initial.sellerId}?lang=${language}`}
              >
                {t("openStore")}
              </Link>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
