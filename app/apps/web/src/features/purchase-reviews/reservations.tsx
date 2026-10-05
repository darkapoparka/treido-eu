"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useClerk } from "@clerk/nextjs";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ConversationDialog } from "../messaging/dialog";
import { variantCaption } from "../inventory/model";
import { cancelReservationAction } from "./actions";
import { CreateReviewButton, reviewError } from "./controls";
import type { ReservationItem, ReservationQueue } from "./reservation-model";
import s from "./reviews.module.css";
import {
  useReservationBatch,
  ReservationBatchPanel,
  ReservationBatchCheckbox,
} from "./bulk-controls";
export function ReservationsPanel({
  data,
  actorSubject,
  view,
  q,
}: {
  data: ReservationQueue;
  actorSubject: string;
  view: "active" | "history";
  q: string;
}) {
  const t = useTranslations("purchaseReviews"),
    locale = useLocale(),
    format = useFormatter(),
    router = useRouter(),
    clerk = useClerk();
  const batch = useReservationBatch(data, actorSubject);
  const [selected, setSelected] = useState<ReservationItem | null>(null),
    [requestId, setRequestId] = useState(""),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    [pending, start] = useTransition();
  const life = useRef({ mounted: true, busy: false });
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
    };
  }, []);
  const base = data.sellerId
    ? "/app/sellers/" + data.sellerId + "/reservations"
    : "/reservations";
  const url = (nextView: string, before?: string) =>
    base +
    "?" +
    new URLSearchParams({
      lang: locale,
      view: nextView,
      ...(q ? { q } : {}),
      ...(before ? { before } : {}),
    });
  const money = (minor: number) =>
    format.number(minor / 100, { style: "currency", currency: "EUR" });
  function cancel() {
    if (!selected || life.current.busy || clerk.user?.id !== actorSubject)
      return;
    const row = selected;
    life.current.busy = true;
    setError(null);
    start(async () => {
      try {
        const result = await cancelReservationAction({
          actorKey: data.actorKey,
          sellerId: data.sellerId,
          threadId: row.threadId,
          offerId: row.offerId,
          expectedRevision: row.offerRevision,
          requestId,
        });
        if (!life.current.mounted || clerk.user?.id !== actorSubject) return;
        if (!result.ok) {
          setError(result.code);
          return;
        }
        setSelected(null);
        setSaved(true);
        router.refresh();
      } catch {
        if (life.current.mounted) setError("NOT_AVAILABLE");
      } finally {
        life.current.busy = false;
      }
    });
  }
  return (
    <div className={s.stack} data-reservations>
      <p>{t(data.sellerId ? "reservationNote" : "buyerReservationNote")}</p>
      <div className={s.actions}>
        <span className={s.badge}>
          {t("activeCount", { count: data.activeCount })}
        </span>
        {data.reconciliationCount > 0 && (
          <span className={s.notice}>
            {t("reconciliationCount", { count: data.reconciliationCount })}
          </span>
        )}
      </div>
      <nav className={s.actions} aria-label={t("reservations")}>
        <Link
          className={s.secondary}
          href={url("active")}
          aria-current={view === "active" ? "page" : undefined}
        >
          {t("active")}
        </Link>
        <Link
          className={s.secondary}
          href={url("history")}
          aria-current={view === "history" ? "page" : undefined}
        >
          {t("history")}
        </Link>
        <button
          className={s.secondary}
          onClick={() => router.refresh()}
          disabled={pending}
        >
          {t("reload")}
        </button>
      </nav>
      <form className={s.actions} action={base}>
        <input
          aria-label={t("search")}
          name="q"
          type="search"
          maxLength={80}
          defaultValue={q}
          placeholder={t("search")}
        />
        <input type="hidden" name="lang" value={locale} />
        <input type="hidden" name="view" value={view} />
        <button className={s.secondary}>{t("searchSubmit")}</button>
      </form>
      <ReservationBatchPanel batch={batch} />
      {saved && <p role="status">{t("cancelled")}</p>}
      {!data.items.length && (
        <section className={s.card}>
          <h2>{t("emptyReservations")}</h2>
        </section>
      )}
      {data.items.map((row) => (
        <section key={row.id} className={s.card} data-reservation-id={row.id}>
          <ReservationBatchCheckbox row={row} batch={batch} />
          <div className={s.row}>
            <h2>{row.sellerName}</h2>
            <span className={s.badge}>{t(row.state)}</span>
          </div>
          <small>
            {t("expiresAt", {
              time: format.dateTime(new Date(row.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </small>
          <ul className={s.lines}>
            {row.lines.map((line) => (
              <li key={line.skuId}>
                <div className={s.row}>
                  <strong>{line.title}</strong>
                  <span>{money(line.unitPriceMinor * line.quantity)}</span>
                </div>
                <small>
                  {variantCaption(line.options)} · {line.quantity} ×{" "}
                  {money(line.unitPriceMinor)}
                </small>
              </li>
            ))}
          </ul>
          <div className={s.actions}>
            {row.threadId && (
              <Link
                className={s.secondary}
                href={
                  (data.sellerId
                    ? "/app/sellers/" + data.sellerId + "/inbox/"
                    : "/messages/") +
                  row.threadId +
                  "?lang=" +
                  locale
                }
              >
                {t("openConversation")}
              </Link>
            )}
            {data.sellerId && (
              <Link
                className={s.secondary}
                href={
                  "/app/sellers/" + data.sellerId + "/inventory?lang=" + locale
                }
              >
                {t("stock")}
              </Link>
            )}
            {row.canCancel && (
              <button
                className={s.secondary}
                disabled={
                  pending ||
                  batch.busy ||
                  batch.draft.entries.some(
                    (entry) => entry.row.allocationId === row.id,
                  )
                }
                onClick={() => {
                  setSelected(row);
                  setRequestId(crypto.randomUUID());
                  setError(null);
                  setSaved(false);
                }}
              >
                {t("cancelHold")}
              </button>
            )}
          </div>
          {!data.sellerId &&
            row.state === "active" &&
            row.threadId &&
            row.offerId && (
              <CreateReviewButton
                actorKey={data.actorKey}
                source={{
                  kind: "offer",
                  threadId: row.threadId,
                  offerId: row.offerId,
                }}
              />
            )}
        </section>
      ))}
      {data.nextBefore && (
        <Link className={s.secondary} href={url(view, data.nextBefore)}>
          {t("older")}
        </Link>
      )}
      {selected && (
        <ConversationDialog
          title={t("cancelHold")}
          onClose={() => {
            if (!pending) setSelected(null);
          }}
        >
          <p>{t("cancelConfirm")}</p>
          <strong>{money(selected.merchandiseMinor)}</strong>
          {error && <p role="alert">{t(reviewError(error))}</p>}
          <div className={s.actions}>
            <button
              className={s.secondary}
              disabled={pending}
              onClick={() => setSelected(null)}
            >
              {t("cancel")}
            </button>
            <button className={s.primary} disabled={pending} onClick={cancel}>
              {t("confirmCancel")}
            </button>
          </div>
        </ConversationDialog>
      )}
    </div>
  );
}
