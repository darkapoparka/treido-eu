"use client";
import { useFormatter, useTranslations } from "next-intl";
import type { OfferItem } from "./model";
import type { OfferMutation } from "./recovery-model";
import s from "./offers.module.css";
import m from "../messaging/messaging.module.css";
export function OfferRecoveryControls({ original, items, pending, error, unrecorded, onCheck, onRetry }: {
  original: OfferMutation; items: readonly OfferItem[]; pending: boolean; error: string | null; unrecorded: boolean;
  onCheck: () => void; onRetry: () => void;
}) {
  const t = useTranslations("offers"), format = useFormatter(), operation = original.command.operation;
  const item = operation.kind === "propose" ? undefined : items.find((value) => value.id === operation.offerId);
  const terms = operation.kind === "propose" ? operation : item;
  const action = operation.kind === "propose" ? operation.parentId ? "counter" : "make" : operation.kind === "cancel" ? "cancelHold" : operation.kind;
  return <section className={s.notice} aria-label={t("originalTitle")}>
    <strong>{t("originalTitle")} · {t(action)}</strong><p>{t("originalNote")}</p>
    {terms && <p>{format.number(terms.quantity)} × {format.number(terms.unitPriceMinor / 100, { style: "currency", currency: "EUR" })} = <strong>{format.number(terms.quantity * terms.unitPriceMinor / 100, { style: "currency", currency: "EUR" })}</strong></p>}
    {operation.kind === "propose" && <p>{t("expires")}: {t("hours", { count: operation.expiresHours })}</p>}
    {item && <p>{t("expiresAt", { time: format.dateTime(new Date(item.expiresAt), { dateStyle: "medium", timeStyle: "short" }) })}</p>}
    <p>{t("originalRevision")}: {format.number(original.command.expectedRevision)}</p>
    <p>{t("originalReference")}: <code style={{ overflowWrap: "anywhere", userSelect: "all" }}>{original.command.requestId}</code></p>
    {unrecorded && <p role="status">{t("originalUnrecorded")}</p>}
    {!terms && <p>{t("originalMissingTerms")}</p>}
    {error && <p role="alert">{t("failed")}</p>}
    <div className={s.actions}>
      <button type="button" className={m.button} disabled={pending} onClick={onCheck}>{t("checkOriginal")}</button>
      <button type="button" className={m.button} disabled={pending || !terms} onClick={onRetry}>{t("retryOriginal")}</button>
    </div>
  </section>;
}
