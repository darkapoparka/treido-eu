"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { object, type PurchaseReview } from "./model";
import { useContactRecovery } from "./contact-recovery";
import { reviewError } from "./controls";
import {
  parseRenewReview,
  type RenewReviewCommand,
  type ReviewRenewalContext,
} from "./renewal-model";
import {
  readReviewRenewalAction,
  renewPurchaseReviewAction,
} from "./renewal-actions";
import s from "./reviews.module.css";

type Recovery = {
  handover: "pickup" | "shipping";
  attempt: RenewReviewCommand | null;
  rejection: string | null;
};
function restore(
  raw: string | null,
  review: PurchaseReview,
  actorKey: string,
): Recovery {
  const fallback: Recovery = {
    handover: review.handover,
    attempt: null,
    rejection: null,
  };
  try {
    if (!raw || raw.length > 4000) return fallback;
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      (value.handover !== "pickup" && value.handover !== "shipping")
    )
      return fallback;
    const attempt =
      value.attempt === null ? null : parseRenewReview(value.attempt);
    if (
      attempt &&
      (attempt.actorKey !== actorKey || attempt.reviewId !== review.id)
    )
      return fallback;
    return {
      handover: value.handover,
      attempt,
      rejection: typeof value.rejection === "string" ? value.rejection : null,
    };
  } catch {
    return fallback;
  }
}
export function ReviewRenewalControl({
  review,
  initial,
  actorKey,
  actorSubject,
}: {
  review: PurchaseReview;
  initial: ReviewRenewalContext;
  actorKey: string;
  actorSubject: string;
}) {
  const t = useTranslations("contactOperations"),
    p = useTranslations("purchaseReviews"),
    format = useFormatter(),
    locale = useLocale(),
    router = useRouter(),
    clerk = useClerk();
  const recovery = useContactRecovery("renewal:" + actorKey + ":" + review.id);
  const draft = useMemo(
    () => restore(recovery.raw, review, actorKey),
    [recovery.raw, review, actorKey],
  );
  const [loaded, setLoaded] = useState<ReviewRenewalContext | null>(null),
    [created, setCreated] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [pending, start] = useTransition();
  const life = useRef({ mounted: true, busy: false });
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
    };
  }, []);
  const context = loaded ?? initial,
    nextId = created ?? initial.nextId ?? context.nextId;
  const sourceMatches = context.handover === draft.handover;
  const alive = () => life.current.mounted && clerk.user?.id === actorSubject;
  function load(resetRejected = false) {
    if (life.current.busy || clerk.user?.id !== actorSubject) return;
    if (resetRejected) {
      if (!draft.rejection) return;
      recovery.write({ ...draft, attempt: null, rejection: null });
    }
    life.current.busy = true;
    setError(null);
    start(async () => {
      try {
        const result = await readReviewRenewalAction(
          review.id,
          actorKey,
          draft.handover,
        );
        if (!alive()) return;
        if (result.ok) setLoaded(result.data);
        else setError(result.code);
      } catch {
        if (alive()) setError("NOT_AVAILABLE");
      } finally {
        life.current.busy = false;
      }
    });
  }
  function rebuild() {
    if (life.current.busy || clerk.user?.id !== actorSubject) return;
    if (!draft.attempt && (!context.available || !sourceMatches || nextId))
      return;
    const command: RenewReviewCommand = draft.attempt ?? {
      actorKey,
      reviewId: review.id,
      requestId: crypto.randomUUID(),
      language: locale === "bg" ? "bg" : "en",
      handover: draft.handover,
      cartRevision: context.cartRevision,
    };
    recovery.write({ ...draft, attempt: command, rejection: null });
    life.current.busy = true;
    setError(null);
    start(async () => {
      try {
        const result = await renewPurchaseReviewAction(command);
        if (!alive()) return;
        if (!result.ok) {
          setError(result.code);
          recovery.write({
            ...draft,
            attempt: command,
            rejection: result.code === "NOT_AVAILABLE" ? null : result.code,
          });
          router.refresh();
          return;
        }
        setCreated(result.data.id);
        recovery.clear();
        router.refresh();
      } catch {
        if (alive()) setError("NOT_AVAILABLE");
      } finally {
        life.current.busy = false;
      }
    });
  }
  return (
    <section className={s.card} data-review-renewal>
      <h2>{t("renewTitle")}</h2>
      <p>{t("renewNote")}</p>
      <p className={s.muted}>
        {t(review.source === "cart" ? "renewCart" : "renewOffer")}
      </p>
      {initial.previousId && (
        <Link
          className={s.secondary}
          href={"/checkout/reviews/" + initial.previousId + "?lang=" + locale}
        >
          {t("openPrevious")}
        </Link>
      )}
      {nextId ? (
        <div className={s.actions}>
          <p role="status">{t("renewed")}</p>
          <Link
            className={s.primary}
            href={"/checkout/reviews/" + nextId + "?lang=" + locale}
          >
            {t("openRenewed")}
          </Link>
        </div>
      ) : (
        <>
          {!context.expired ? (
            <p>{t("reviewLive")}</p>
          ) : (
            <>
              <label className={s.field}>
                {p("handover")}
                <select
                  value={draft.handover}
                  disabled={pending || !!draft.attempt}
                  onChange={(event) =>
                    recovery.write({
                      ...draft,
                      handover: event.target.value,
                      attempt: null,
                      rejection: null,
                    })
                  }
                >
                  <option value="pickup">{p("pickup")}</option>
                  <option value="shipping">{p("shipping")}</option>
                </select>
              </label>
              <div className={s.actions}>
                <button
                  className={s.secondary}
                  disabled={pending}
                  onClick={() => load()}
                >
                  {t("previewSource")}
                </button>
              </div>
              {!sourceMatches && <p>{t("sourceMismatch")}</p>}
              {sourceMatches && context.reason && (
                <p className={s.notice}>{t(context.reason)}</p>
              )}
              {sourceMatches && context.available && (
                <>
                  <p className={s.muted}>{t("previewNote")}</p>
                  <ul className={s.lines}>
                    {context.lines.map((line) => (
                      <li key={line.skuId}>
                        <div className={s.row}>
                          <strong>{line.title}</strong>
                          <span>
                            {line.quantity} ×{" "}
                            {format.number(line.unitPriceMinor / 100, {
                              style: "currency",
                              currency: "EUR",
                            })}
                          </span>
                        </div>
                        <small>{Object.values(line.options).join(" / ")}</small>
                      </li>
                    ))}
                  </ul>
                  <p>
                    <strong>
                      {t("subtotal")}:{" "}
                      {format.number((context.merchandiseMinor ?? 0) / 100, {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </strong>
                  </p>
                </>
              )}
              <button
                className={s.primary}
                disabled={
                  pending ||
                  (!draft.attempt && (!context.available || !sourceMatches))
                }
                onClick={rebuild}
              >
                {t(pending ? "saving" : draft.attempt ? "retry" : "renewNow")}
              </button>
            </>
          )}
          {draft.attempt && <p className={s.notice}>{t("renewRecovery")}</p>}
          {draft.rejection && (
            <button
              className={s.secondary}
              disabled={pending}
              onClick={() => load(true)}
            >
              {t("newSource")}
            </button>
          )}
        </>
      )}
      {(error || draft.rejection) && (
        <p role="alert">{p(reviewError(error ?? draft.rejection!))}</p>
      )}
      <div className={s.actions}>
        <Link className={s.secondary} href={"/cart?lang=" + locale}>
          {p("cart")}
        </Link>
        {review.threadId && (
          <Link
            className={s.secondary}
            href={"/messages/" + review.threadId + "?lang=" + locale}
          >
            {p("openConversation")}
          </Link>
        )}
      </div>
    </section>
  );
}
