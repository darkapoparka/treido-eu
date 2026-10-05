"use client";
import type messages from "./messages.json";
type SettingsMessageKey = keyof typeof messages.en;
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
  readServiceSettingsAction,
  saveServiceSettingsAction,
} from "./actions";
import type { ServiceCommand, ServicePayload, ServiceView } from "./model";
import a from "../sellers/admin.module.css";
import s from "../team/team.module.css";

export function ServiceSettingsForm({
  initial,
  actorSubject,
  language,
}: {
  initial: ServiceView;
  actorSubject: string;
  language: "bg" | "en";
}) {
  const t = useTranslations("sellerSettings"),
    clerk = useClerk(),
    sellerId = initial.sellerId,
    section = initial.section;
  const load = useCallback(
    () => readServiceSettingsAction(sellerId, section),
    [sellerId, section],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const [payload, setPayload] = useState<ServicePayload>(initial.payload),
    [saved, setSaved] = useState(JSON.stringify(initial.payload)),
    [revision, setRevision] = useState(initial.revision),
    [latest, setLatest] = useState<ServiceView | null>(null),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState<string | null>(null),
    [blocked, setBlocked] = useState(false);
  const live = useRef(true),
    busy = useRef(false),
    attempt = useRef<{ hash: string; command: ServiceCommand } | null>(null);
  const hidden = blocked || status !== "ready",
    dirty = JSON.stringify(payload) !== saved;
  useUnsavedChanges(dirty && !blocked && status !== "denied", language);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const here = (path: string) =>
    live.current &&
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
    const hash = JSON.stringify({ payload, revision });
    if (attempt.current?.hash !== hash)
      attempt.current = {
        hash,
        command: {
          sellerId,
          section,
          expectedRevision: revision,
          payload,
          requestId: crypto.randomUUID(),
        },
      };
    busy.current = true;
    setPending(true);
    setNotice(null);
    const path = location.pathname;
    try {
      const result = await saveServiceSettingsAction(attempt.current.command);
      if (!here(path)) return;
      if (!result.ok) {
        failure(result.code);
        return;
      }
      setPayload(result.data.payload);
      setSaved(JSON.stringify(result.data.payload));
      setRevision(result.data.revision);
      setLatest(null);
      attempt.current = null;
      setNotice("SAVED");
      await refresh();
    } catch {
      if (here(path)) setNotice("NOT_AVAILABLE");
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  }
  async function compare() {
    if (busy.current || hidden) return;
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
      if (live.current) setPending(false);
    }
  }
  const values = payload as unknown as Record<string, string | boolean>;
  function change(field: string, value: string | boolean) {
    setPayload({ ...payload, [field]: value });
    setNotice(null);
  }
  function text(
    field: string,
    label: SettingsMessageKey,
    max: number,
    multiline = false,
    type = "text",
  ) {
    return (
      <label className={s.field}>
        {t(label)}
        {multiline ? (
          <textarea
            name={field}
            rows={4}
            maxLength={max}
            value={String(values[field] ?? "")}
            onChange={(e) => change(field, e.target.value)}
          />
        ) : (
          <input
            name={field}
            type={type}
            maxLength={max}
            value={String(values[field] ?? "")}
            onChange={(e) => change(field, e.target.value)}
          />
        )}
      </label>
    );
  }
  function checkbox(field: string, label: SettingsMessageKey) {
    return (
      <label className={s.checkbox}>
        <input
          name={field}
          type="checkbox"
          checked={values[field] === true}
          onChange={(e) => change(field, e.target.checked)}
        />
        <span>{t(label)}</span>
      </label>
    );
  }
  const labels: Record<string, SettingsMessageKey> = {
    published: "published",
    publicEmail: "publicEmail",
    publicPhone: "publicPhone",
    contactNote: "contactField",
    pickup: "pickup",
    pickupArea: "pickupArea",
    pickupNote: "pickupNote",
    deliveryByArrangement: "deliveryByArrangement",
    deliveryNote: "deliveryNote",
    returnsNote: "returnsNote",
  };
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t(section)}</h1>
        <Link
          className={a.secondary}
          href={"/app/sellers/" + sellerId + "/settings?lang=" + language}
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
                  ? "denied"
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
        <div
          className={s.stack}
          hidden={hidden}
          data-service-settings={section}
        >
          <section className={s.card}>
            <h2>{initial.name}</h2>
            <p>
              {t(section === "contact" ? "contactNote" : "deliveryDescription")}
            </p>
            <p className={s.muted}>{t("privateNote")}</p>
          </section>
          <form className={s.card} onSubmit={submit}>
            <fieldset disabled={pending || hidden} className={s.form}>
              {checkbox(
                "published",
                section === "contact"
                  ? "publishedContact"
                  : "publishedDelivery",
              )}
              {section === "contact" ? (
                <>
                  {text("publicEmail", "publicEmail", 254, false, "email")}
                  {text("publicPhone", "publicPhone", 40, false, "tel")}
                  {text("contactNote", "contactMessage", 1200, true)}
                </>
              ) : (
                <>
                  {checkbox("pickup", "pickup")}
                  {text("pickupArea", "pickupArea", 100)}
                  {text("pickupNote", "pickupNote", 1200, true)}
                  {checkbox("deliveryByArrangement", "deliveryByArrangement")}
                  {text("deliveryNote", "deliveryNote", 1200, true)}
                  {text("returnsNote", "returnsNote", 2000, true)}
                </>
              )}
              <p className={s.muted}>{t("publicNote")}</p>
              <div className={s.actions}>
                <button className={a.primary}>
                  {t(pending ? "saving" : "save")}
                </button>
                <span className={s.muted}>{t("revision", { revision })}</span>
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
                  ? "saved"
                  : notice === "CONFLICT"
                    ? "conflict"
                    : notice === "INVALID_INPUT"
                      ? "invalid"
                      : "unavailable",
              )}
            </p>
          )}
          {(notice === "CONFLICT" || data.revision > revision) && (
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
                {Object.entries(latest.payload).map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      <strong>{t(labels[key])}</strong>
                    </dt>
                    <dd className={s.compare}>
                      {typeof value === "boolean"
                        ? t(value ? "yes" : "no")
                        : value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
              <p>{t("replaceNote")}</p>
              <button
                className={a.secondary}
                onClick={() => {
                  setPayload(latest.payload);
                  setRevision(latest.revision);
                  setSaved(JSON.stringify(latest.payload));
                  attempt.current = null;
                  setLatest(null);
                  setNotice(null);
                }}
              >
                {t("load")}
              </button>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
