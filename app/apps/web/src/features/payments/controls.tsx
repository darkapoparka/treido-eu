"use client";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useUser, useClerk, useReverification } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { validId } from "../selling/draft-model";
import type { ReviewSource } from "../purchase-reviews/model";
import {
  createQuoteAction,
  startOnboardingAction,
  changeOrderAction,
} from "./actions";
import type { AftercareChoice } from "../order-aftercare/model";
import type { OrderCommand, OrderView } from "./model";
import { paymentText, paymentError, type PaymentLanguage } from "./messages";
import s from "../purchase-reviews/reviews.module.css";

export function PaymentBoundary({
  actorSubject,
  language,
  children,
}: {
  actorSubject: string;
  language: PaymentLanguage;
  children: ReactNode;
}) {
  const { isLoaded, user } = useUser(),
    router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  useEffect(() => {
    if (isLoaded && user?.id !== actorSubject) router.refresh();
  }, [isLoaded, user?.id, actorSubject, router]);
  if (!isLoaded || user?.id !== actorSubject)
    return (
      <p role="status">
        {isLoaded
          ? paymentText(language).denied
          : paymentText(language).checking}
      </p>
    );
  return children;
}
function requestId(scope: string) {
  try {
    const prior = sessionStorage.getItem(scope);
    if (prior && validId(prior)) return prior;
  } catch {}
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(scope, id);
  } catch {}
  return id;
}
function usePaymentLifetime() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
export function CreateQuoteButton({
  actorKey,
  actorSubject,
  source,
  policyId,
  language,
  aftercare,
}: {
  actorKey: string;
  actorSubject: string;
  source: ReviewSource;
  policyId: string;
  language: PaymentLanguage;
  aftercare?: AftercareChoice;
}) {
  const clerk = useClerk(),
    router = useRouter(),
    [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null),
    busy = useRef(false);
  const t = paymentText(language);
  const mounted = usePaymentLifetime();
  return (
    <>
      <button
        className={s.primary}
        disabled={pending}
        onClick={() => {
          if (busy.current || clerk.user?.id !== actorSubject) return;
          busy.current = true;
          setError(null);
          const command = {
            actorKey,
            source,
            policyId,
            language,
            ...(aftercare ? { aftercare } : {}),
            handover: "pickup",
            requestId: requestId(
              `treido-payment-quote:${actorKey}:${JSON.stringify({ source, policyId, language, ...(aftercare ? { aftercare } : {}) })}`,
            ),
          };
          start(async () => {
            try {
              const result = await createQuoteAction(command);
              if (!mounted.current || clerk.user?.id !== actorSubject) return;
              if (result.ok)
                router.push(
                  `/checkout/payments/${result.data.id}?lang=${language}`,
                );
              else setError(paymentError(result.code, language));
            } catch {
              if (mounted.current && clerk.user?.id === actorSubject)
                setError(t.failed);
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        {t.review}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function OnboardingButton({
  actorKey,
  actorSubject,
  sellerId,
  language,
}: {
  actorKey: string;
  actorSubject: string;
  sellerId: string;
  language: PaymentLanguage;
}) {
  const clerk = useClerk(),
    [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null),
    busy = useRef(false),
    request = useRef<string | null>(null);
  const action = useReverification(startOnboardingAction),
    t = paymentText(language);
  const mounted = usePaymentLifetime();
  return (
    <>
      <button
        className={s.primary}
        disabled={pending}
        onClick={() => {
          if (busy.current || clerk.user?.id !== actorSubject) return;
          busy.current = true;
          setError(null);
          request.current ??= crypto.randomUUID();
          start(async () => {
            try {
              const result = await action({
                actorKey,
                id: sellerId,
                requestId: request.current,
              });
              if (
                !result ||
                !mounted.current ||
                clerk.user?.id !== actorSubject
              )
                return;
              if (result.ok) window.location.assign(result.data.url);
              else {
                if (result.code === "CONFLICT") request.current = null;
                setError(paymentError(result.code, language));
              }
            } catch {
              if (mounted.current && clerk.user?.id === actorSubject)
                setError(t.failed);
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        {t.onboarding}
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function OrderControls({
  order,
  actorKey,
  actorSubject,
  sellerId,
  canFulfil,
  canRefund,
  language,
}: {
  order: OrderView;
  actorKey: string;
  actorSubject: string;
  sellerId: string | null;
  canFulfil: boolean;
  canRefund: boolean;
  language: PaymentLanguage;
}) {
  const clerk = useClerk(),
    router = useRouter(),
    [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    busy = useRef(false);
  const action = useReverification(changeOrderAction),
    t = paymentText(language),
    scope = `treido-order-command:${actorKey}:${order.id}`;
  const mounted = usePaymentLifetime();
  const [recovery, setRecovery] = useState<OrderCommand | null>(null);
  useEffect(() => {
    function restore() {
      try {
        const raw = sessionStorage.getItem(scope);
        if (raw) {
          const value = JSON.parse(raw) as OrderCommand;
          if (
            value.id === order.id &&
            value.actorKey === actorKey &&
            validId(value.requestId)
          )
            setRecovery(value);
        }
      } catch {}
    }
    const timer = window.setTimeout(restore, 0);
    window.addEventListener("pageshow", restore);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", restore);
    };
  }, [scope, order.id, actorKey]);
  function submit(kind: OrderCommand["action"]) {
    if (
      busy.current ||
      clerk.user?.id !== actorSubject ||
      (kind === "refund" && !confirmed)
    )
      return;
    const command = recovery ?? {
      actorKey,
      id: order.id,
      sellerId,
      requestId: crypto.randomUUID(),
      action: kind,
      expectedRevision: order.revision,
      reason: kind === "refund" ? reason : "",
    };
    if (command.action !== kind) return;
    setRecovery(command);
    try {
      sessionStorage.setItem(scope, JSON.stringify(command));
    } catch {}
    busy.current = true;
    setError(null);
    start(async () => {
      try {
        const result = await action(command);
        if (!result || !mounted.current || clerk.user?.id !== actorSubject)
          return;
        if (result.ok) {
          try {
            sessionStorage.removeItem(scope);
          } catch {}
          setRecovery(null);
          setReason("");
          setConfirmed(false);
          router.refresh();
        } else setError(paymentError(result.code, language));
      } catch {
        if (mounted.current && clerk.user?.id === actorSubject)
          setError(t.failed);
      } finally {
        busy.current = false;
      }
    });
  }
  const paid =
    order.paymentState === "paid" && order.settlementState === "transferred";
  return (
    <div className={s.stack}>
      {sellerId && canFulfil && paid && order.fulfilmentState === "pending" && (
        <button
          className={s.primary}
          disabled={pending || (!!recovery && recovery.action !== "ready")}
          onClick={() => submit("ready")}
        >
          {t.readyAction}
        </button>
      )}
      {!sellerId && paid && order.fulfilmentState === "ready" && (
        <button
          className={s.primary}
          disabled={pending}
          onClick={() => submit("collected")}
        >
          {t.collectedAction}
        </button>
      )}
      {sellerId &&
        canRefund &&
        !order.refundState &&
        ["paid", "reconciliation", "disputed"].includes(order.paymentState) && (
          <fieldset disabled={pending} className={s.field}>
            <label>
              {t.reason}
              <textarea
                maxLength={500}
                value={recovery?.action === "refund" ? recovery.reason : reason}
                disabled={recovery?.action === "refund"}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              {t.confirmRefund}
            </label>
            <button
              className={s.secondary}
              disabled={
                !confirmed ||
                !(recovery?.reason ?? reason).trim() ||
                (!!recovery && recovery.action !== "refund")
              }
              onClick={() => submit("refund")}
            >
              {t.refundAction}
            </button>
            <p className={s.muted}>{t.refundNotice}</p>
          </fieldset>
        )}
      {recovery && (
        <section className={s.stack}>
          <p role="status">{t.reconciling}</p>
          {recovery.action === "refund" && (
            <>
              <p>
                {t.reason}: {recovery.reason}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                {t.confirmRefund}
              </label>
            </>
          )}
          <button
            className={s.secondary}
            disabled={pending || (recovery.action === "refund" && !confirmed)}
            onClick={() => submit(recovery.action)}
          >
            {t.retryOriginal}
          </button>
        </section>
      )}
      <button
        className={s.secondary}
        onClick={() => router.refresh()}
        disabled={pending}
      >
        {t.refresh}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
