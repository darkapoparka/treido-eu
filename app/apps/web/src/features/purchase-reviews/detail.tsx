"use client";
import Link from "next/link";
import { useRef, useState, useTransition, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { variantCaption } from "../inventory/model";
import { editPurchaseReviewAction, sendPurchaseReviewAction } from "./actions";
import { reviewMessage, type PurchaseReview } from "./model";
import { useReviewNoteDraft } from "./note-draft";
import { reviewError } from "./controls";
import s from "./reviews.module.css";
import { ReviewRenewalControl } from "./renewal-control";
import type { ReviewRenewalContext } from "./renewal-model";
export function PurchaseReviewDetail({
  initial,
  actorKey,
  actorSubject,
  renewal,
}: {
  initial: PurchaseReview;
  renewal?: ReviewRenewalContext;
  actorKey: string;
  actorSubject: string;
}) {
  const t = useTranslations("purchaseReviews"),
    format = useFormatter(),
    locale = useLocale(),
    router = useRouter(),
    clerk = useClerk();
  const { draft, update } = useReviewNoteDraft(initial, actorKey);
  const { note, revision, archived } = draft;
  const [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    [sentThread, setSentThread] = useState<string | null>(null);
  const life = useRef({ mounted: true, busy: false });
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
    };
  }, []);
  const money = (n: number) =>
    format.number(n / 100, { style: "currency", currency: "EUR" });
  const time = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const contactThread = sentThread ?? initial.contactThreadId;
  function save(nextArchived = archived) {
    if (life.current.busy || clerk.user?.id !== actorSubject) return;
    const key = JSON.stringify({ note, archived: nextArchived, revision });
    const attempt =
      draft.attempt?.key === key
        ? draft.attempt
        : {
            key,
            command: {
              reviewId: initial.id,
              actorKey,
              requestId: crypto.randomUUID(),
              expectedRevision: revision,
              note,
              archived: nextArchived,
            },
          };
    const command = attempt.command;
    update({ attempt });
    life.current.busy = true;
    setError(null);
    setSaved(false);
    start(async () => {
      try {
        const result = await editPurchaseReviewAction(command);
        if (!life.current.mounted || clerk.user?.id !== actorSubject) return;
        if (!result.ok) {
          setError(result.code);
          return;
        }
        update({
          attempt: null,
          revision: result.data.revision,
          archived: nextArchived,
          note: command.note.trim(),
        });
        setSaved(true);
        router.refresh();
      } catch {
        if (life.current.mounted) setError("NOT_AVAILABLE");
      } finally {
        life.current.busy = false;
      }
    });
  }
  function send() {
    if (life.current.busy || clerk.user?.id !== actorSubject) return;
    life.current.busy = true;
    setError(null);
    start(async () => {
      try {
        const result = await sendPurchaseReviewAction(initial.id, actorKey);
        if (!life.current.mounted || clerk.user?.id !== actorSubject) return;
        if (!result.ok) {
          setError(result.code);
          return;
        }
        setSentThread(result.data.threadId);
        router.refresh();
      } catch {
        if (life.current.mounted) setError("NOT_AVAILABLE");
      } finally {
        life.current.busy = false;
      }
    });
  }
  const changed = initial.lines.some((line) => !line.current),
    shortage =
      initial.source === "cart" &&
      initial.lines.some(
        (l) => l.available !== null && l.available < l.quantity,
      );
  const canSend =
    !initial.expired &&
    !archived &&
    !changed &&
    !shortage &&
    (initial.source !== "offer" || initial.holdState === "active");
  return (
    <div className={s.stack} data-purchase-review={initial.id}>
      <section className={s.card}>
        <div className={s.row}>
          <h2>{initial.sellerName}</h2>
          <span className={s.badge}>{t(initial.source)}</span>
        </div>
        <p>{t("contactOnly")}</p>
        <p className={s.muted}>
          {t(initial.source === "offer" ? "existingHold" : "noReservation")}
        </p>
        <small>{t("reviewedAt", { time: time(initial.createdAt) })}</small>
        <p>{t("expiresAt", { time: time(initial.expiresAt) })}</p>
        {initial.expired && <p className={s.notice}>{t("expiredNote")}</p>}
        {initial.holdState && (
          <p>
            {t("reservations")}: {t(initial.holdState)}
          </p>
        )}
        <ol className={s.lines}>
          {initial.lines.map((line) => (
            <li key={line.skuId}>
              <div className={s.row}>
                <Link href={"/products/" + line.listingId + "?lang=" + locale}>
                  {line.title}
                </Link>
                <strong>{money(line.unitPriceMinor * line.quantity)}</strong>
              </div>
              <p className={s.muted}>
                {variantCaption(line.options)} · {line.quantity} ×{" "}
                {money(line.unitPriceMinor)}
              </p>
              <p>{line.deliveryDetails}</p>
              {!line.current && <p className={s.notice}>{t("changed")}</p>}
              {initial.source === "cart" &&
                line.available !== null &&
                line.available < line.quantity && (
                  <p className={s.notice}>{t("shortage")}</p>
                )}
            </li>
          ))}
        </ol>
        <dl className={s.totals}>
          <div>
            <dt>{t("subtotal")}</dt>
            <dd>{money(initial.merchandiseMinor)}</dd>
          </div>
          <div>
            <dt>{t("handover")}</dt>
            <dd>{t(initial.handover)}</dd>
          </div>
          {(["fees", "delivery", "payable"] as const).map((label) => (
            <div key={label}>
              <dt>{t(label)}</dt>
              <dd>{t("unknown")}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className={s.primary} disabled>
          {t("pay")}
        </button>
        <p className={s.muted}>{t("paymentUnavailable")}</p>
      </section>
      {renewal && (
        <ReviewRenewalControl
          review={initial}
          initial={renewal}
          actorKey={actorKey}
          actorSubject={actorSubject}
        />
      )}
      <section className={s.card}>
        <h2>{t("contact")}</h2>
        <details>
          <summary>{t("sendPreview")}</summary>
          <pre className={s.preview}>{reviewMessage(initial)}</pre>
        </details>
        {contactThread ? (
          <div className={s.actions}>
            <span role="status">{t("sent")}</span>
            <Link
              className={s.primary}
              href={"/messages/" + contactThread + "?lang=" + locale}
            >
              {t("openConversation")}
            </Link>
          </div>
        ) : (
          <button
            type="button"
            className={s.primary}
            disabled={pending || !canSend}
            onClick={send}
          >
            {t(pending ? "sending" : "send")}
          </button>
        )}
        {initial.threadId && (
          <Link
            className={s.secondary}
            href={"/messages/" + initial.threadId + "?lang=" + locale}
          >
            {t("offer")}
          </Link>
        )}
      </section>
      <form
        className={s.card}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label className={s.field}>
          {t("note")}
          <textarea
            maxLength={1000}
            rows={5}
            disabled={pending}
            value={note}
            onChange={(event) => {
              update({ note: event.target.value, attempt: null });
              setSaved(false);
            }}
          />
        </label>
        <p className={s.muted}>{t("noteHint")}</p>
        <div className={s.actions}>
          <button className={s.primary} disabled={pending}>
            {t(pending ? "saving" : "save")}
          </button>
          <button
            type="button"
            className={s.secondary}
            disabled={pending}
            onClick={() => save(!archived)}
          >
            {t(archived ? "restore" : "archive")}
          </button>
        </div>
        <p className={s.muted}>{t("archiveNote")}</p>
        {initial.revision !== revision && (
          <div className={s.actions}>
            <button
              className={s.secondary}
              type="button"
              disabled={pending}
              onClick={() => {
                update({
                  revision: initial.revision,
                  archived: initial.archived,
                  attempt: null,
                });
                setError(null);
              }}
            >
              {t("keepNote")}
            </button>
            <button
              className={s.secondary}
              type="button"
              disabled={pending}
              onClick={() => {
                update({
                  note: initial.note,
                  revision: initial.revision,
                  archived: initial.archived,
                  attempt: null,
                });
                setError(null);
              }}
            >
              {t("loadSaved")}
            </button>
          </div>
        )}
        {saved && <p role="status">{t("saved")}</p>}
      </form>
      {error && (
        <p role="alert" className={s.notice}>
          {t(reviewError(error))}
        </p>
      )}
      <div className={s.actions}>
        <button
          className={s.secondary}
          disabled={pending}
          onClick={() => router.refresh()}
        >
          {t("reload")}
        </button>
        <Link className={s.secondary} href={"/reservations?lang=" + locale}>
          {t("reservations")}
        </Link>
        <Link className={s.secondary} href={"/cart?lang=" + locale}>
          {t("cart")}
        </Link>
      </div>
    </div>
  );
}
