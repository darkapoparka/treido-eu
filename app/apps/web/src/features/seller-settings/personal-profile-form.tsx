"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
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
  const t = useTranslations("sellerSettings"),
    clerk = useClerk();
  const load = useCallback(
    () => readPersonalProfileAction(initial.sellerId),
    [initial.sellerId],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const [profile, setProfile] = useState(initial.profile);
  const [saved, setSaved] = useState(initial);
  const [latest, setLatest] = useState<PersonalProfileView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false);
  const alive = useRef(true),
    busy = useRef(false);
  const attempt = useRef<{
    hash: string;
    command: PersonalProfileCommand;
  } | null>(null);
  const hidden = blocked || status !== "ready";
  useUnsavedChanges(
    !hidden && JSON.stringify(profile) !== JSON.stringify(saved.profile),
    language,
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const here = (path: string) =>
    alive.current &&
    clerk.user?.id === actorSubject &&
    location.pathname === path;
  function failure(code: string) {
    setNotice(code);
    if (["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(code))
      setBlocked(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (hidden || busy.current || clerk.user?.id !== actorSubject) return;
    const hash = JSON.stringify({ profile, revision: saved.revision });
    if (attempt.current?.hash !== hash)
      attempt.current = {
        hash,
        command: {
          sellerId: initial.sellerId,
          expectedRevision: saved.revision,
          requestId: crypto.randomUUID(),
          profile,
        },
      };
    busy.current = true;
    setPending(true);
    setNotice(null);
    const path = location.pathname;
    try {
      const result = await savePersonalProfileAction(attempt.current.command);
      if (!here(path)) return;
      if (!result.ok) {
        failure(result.code);
        return;
      }
      setProfile(result.data.profile);
      setSaved(result.data);
      setLatest(null);
      attempt.current = null;
      setNotice("SAVED");
      await refresh();
    } catch {
      if (here(path)) setNotice("NOT_AVAILABLE");
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  async function compare() {
    if (hidden || busy.current || clerk.user?.id !== actorSubject) return;
    busy.current = true;
    setPending(true);
    const path = location.pathname;
    try {
      const result = await load();
      if (!here(path)) return;
      if (result.ok) setLatest(result.data);
      else failure(result.code);
    } catch {
      if (here(path)) setNotice("NOT_AVAILABLE");
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  function applyLatest(replace: boolean) {
    if (!latest || hidden || pending) return;
    if (replace) setProfile(latest.profile);
    setSaved(latest);
    setLatest(null);
    setNotice(null);
    attempt.current = null;
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
                blocked || status === "denied"
                  ? "profileDenied"
                  : status === "checking"
                    ? "checking"
                    : "unavailable",
              )}
            </p>
            <button className={a.secondary} onClick={() => void refresh(true)}>
              {t("retry")}
            </button>
          </section>
        )}
        <div className={s.stack} hidden={hidden} data-personal-profile="true">
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
                  onChange={(e) => {
                    setProfile({ ...profile, name: e.target.value });
                    setNotice(null);
                  }}
                />
              </label>
              <label className={s.field}>
                {t("profileLocality")}
                <input
                  name="locality"
                  maxLength={100}
                  value={profile.locality}
                  onChange={(e) => {
                    setProfile({ ...profile, locality: e.target.value });
                    setNotice(null);
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
                  onChange={(e) => {
                    setProfile({ ...profile, description: e.target.value });
                    setNotice(null);
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
              onClick={() => void compare()}
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
                <dd className={s.compare}>{latest.profile.locality || "—"}</dd>
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
      </div>
    </main>
  );
}
