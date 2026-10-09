"use client";
import type messages from "./messages.json";
type SettingsMessageKey = keyof typeof messages.en;
import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useSettingsSession } from "./use-settings-session";
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
    sellerId = initial.sellerId,
    section = initial.section;
  const load = useCallback(
    () => readServiceSettingsAction(sellerId, section),
    [sellerId, section],
  );
  const session = useSettingsSession<ServiceView, ServiceCommand>(
    initial,
    actorSubject,
    load,
    saveServiceSettingsAction,
  );
  const { data, status, pending, notice, latest, editKey } = session;
  const [editor, setEditor] = useState({
    key: null as string | null,
    payload: initial.payload,
    saved: JSON.stringify(initial.payload),
    revision: initial.revision,
  });
  const { payload, saved, revision } = editor;
  const hidden = session.hidden || editor.key !== editKey,
    dirty = JSON.stringify(payload) !== saved;
  useUnsavedChanges(dirty && !hidden, language);
  // A new editor owner receives only an accepted read (or its exact journal).
  // React restarts this render before committing any former private children.
  if (!session.hidden && editor.key !== editKey) {
    setEditor({
      key: editKey,
      payload: (session.retained?.payload as ServicePayload) ?? data.payload,
      saved: JSON.stringify(data.payload),
      revision: session.retained?.expectedRevision ?? data.revision,
    });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (hidden) return;
    await session.submit(
      {
        sellerId,
        section,
        expectedRevision: revision,
        payload,
        requestId: crypto.randomUUID(),
      },
      (value) => {
        setEditor({
          key: editKey,
          payload: value.payload,
          saved: JSON.stringify(value.payload),
          revision: value.revision,
        });
      },
    );
  }
  const values = payload as unknown as Record<string, string | boolean>;
  function change(field: string, value: string | boolean) {
    if (!session.edit()) return;
    setEditor({ ...editor, payload: { ...payload, [field]: value } });
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
            readOnly={session.uncertain}
            onChange={(e) => change(field, e.target.value)}
          />
        ) : (
          <input
            name={field}
            type={type}
            maxLength={max}
            value={String(values[field] ?? "")}
            readOnly={session.uncertain}
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
          disabled={session.uncertain}
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
                session.denied
                  ? "denied"
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
          <div className={s.stack} data-service-settings={section}>
            <section className={s.card}>
              <h2>{data.name}</h2>
              <p>
                {t(
                  section === "contact" ? "contactNote" : "deliveryDescription",
                )}
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
                    if (!session.clearAttempt()) return;
                    setEditor({
                      key: editKey,
                      payload: latest.payload,
                      saved: JSON.stringify(latest.payload),
                      revision: latest.revision,
                    });
                  }}
                >
                  {t("load")}
                </button>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
