"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripePaymentElement,
} from "@stripe/stripe-js";
import type { QuoteView } from "./model";
import { beginPaymentAction, cancelPaymentAction } from "./actions";
import { paymentError, paymentText, type PaymentLanguage } from "./messages";
import s from "../purchase-reviews/reviews.module.css";

export function PaymentCheckout({
  quote,
  actorKey,
  actorSubject,
  language,
}: {
  quote: QuoteView;
  actorKey: string;
  actorSubject: string;
  language: PaymentLanguage;
}) {
  const clerk = useClerk(),
    router = useRouter(),
    t = paymentText(language),
    [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null),
    [working, setWorking] = useState(false);
  const [configuration, setConfiguration] = useState<{
      clientSecret: string;
      publishableKey: string;
    } | null>(null),
    [mountedElement, setMountedElement] = useState(false);
  const node = useRef<HTMLDivElement>(null),
    provider = useRef<{ stripe: Stripe; elements: StripeElements } | null>(
      null,
    ),
    life = useRef({ mounted: true, busy: false }),
    request = useRef(crypto.randomUUID());
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      provider.current = null;
    };
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const key of [
      "payment_intent_client_secret",
      "payment_intent",
      "redirect_status",
    ])
      url.searchParams.delete(key);
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  }, []);
  useEffect(() => {
    if (!configuration || !node.current) return;
    let alive = true,
      element: StripePaymentElement | undefined;
    void (async () => {
      try {
        const stripe = await loadStripe(configuration.publishableKey);
        if (
          !stripe ||
          !alive ||
          clerk.user?.id !== actorSubject ||
          !node.current
        )
          return;
        const elements = stripe.elements({
          clientSecret: configuration.clientSecret,
          locale: language,
        });
        element = elements.create("payment", { layout: "tabs" });
        element.on("ready", () => {
          if (alive) setMountedElement(true);
        });
        element.on("loaderror", () => {
          if (alive) setError(t.failed);
        });
        element.mount(node.current);
        provider.current = { stripe, elements };
      } catch {
        if (alive) setError(t.failed);
      }
    })();
    return () => {
      alive = false;
      element?.destroy();
      provider.current = null;
    };
  }, [configuration, actorSubject, clerk, language, t.failed]);
  function owned() {
    return life.current.mounted && clerk.user?.id === actorSubject;
  }
  function begin() {
    if (life.current.busy || !owned()) return;
    life.current.busy = true;
    setError(null);
    start(async () => {
      try {
        const result = await beginPaymentAction({
          actorKey,
          id: quote.id,
          requestId: request.current,
        });
        if (!owned()) return;
        if (!result.ok) setError(paymentError(result.code, language));
        else if (
          result.data.status === "ready" &&
          "clientSecret" in result.data
        ) {
          setConfiguration({
            clientSecret: result.data.clientSecret,
            publishableKey: result.data.publishableKey,
          });
          setWorking(false);
        } else {
          setWorking(true);
          router.refresh();
        }
      } catch {
        if (owned()) setError(t.failed);
      } finally {
        life.current.busy = false;
      }
    });
  }
  function cancel() {
    if (life.current.busy || !owned()) return;
    life.current.busy = true;
    setConfiguration(null);
    setMountedElement(false);
    setError(null);
    start(async () => {
      try {
        const result = await cancelPaymentAction({
          actorKey,
          id: quote.id,
          requestId: request.current,
        });
        if (!owned()) return;
        if (!result.ok) setError(paymentError(result.code, language));
        else {
          setWorking(true);
          router.refresh();
        }
      } catch {
        if (owned()) setError(t.failed);
      } finally {
        life.current.busy = false;
      }
    });
  }
  async function confirm() {
    if (
      life.current.busy ||
      !owned() ||
      !provider.current ||
      Date.now() >= new Date(quote.expiresAt).getTime()
    )
      return;
    life.current.busy = true;
    setError(null);
    setWorking(true);
    try {
      const result = await provider.current.stripe.confirmPayment({
        elements: provider.current.elements,
        confirmParams: {
          return_url:
            window.location.origin +
            `/checkout/payments/${quote.id}?lang=${language}`,
        },
        redirect: "if_required",
      });
      if (!owned()) return;
      // A browser result can only request a status refresh. Server settlement
      // always retrieves Stripe and commits through the signed executor.
      if (result.error) {
        setError(t.failed);
        setWorking(false);
      } else {
        setConfiguration(null);
        setMountedElement(false);
        router.refresh();
      }
    } catch {
      if (owned()) {
        setConfiguration(null);
        setMountedElement(false);
        setError(t.reconciling);
      }
    } finally {
      life.current.busy = false;
    }
  }
  return (
    <section className={s.stack}>
      {quote.orderId ? (
        <>
          <p>{t.succeeded}</p>
          <Link
            className={s.primary}
            href={`/orders/${quote.orderId}?lang=${language}`}
          >
            {t.orders}
          </Link>
        </>
      ) : (
        <>
          {quote.expired && <p role="status">{t.expired}</p>}
          {quote.attempt && (
            <p>
              {t.status}: {t.statuses[quote.attempt.state]}
            </p>
          )}
          {working && <p role="status">{t.reconciling}</p>}
          {!quote.expired &&
            !configuration &&
            ![
              "paid",
              "cancelled",
              "quarantined",
              "cancelling",
              "processing",
            ].includes(quote.attempt?.state ?? "") && (
              <button
                className={s.primary}
                disabled={pending || working}
                onClick={begin}
              >
                {t.pay}
              </button>
            )}
          {configuration && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void confirm();
              }}
            >
              <div ref={node} />
              <button
                className={s.primary}
                disabled={
                  !mountedElement || pending || working || quote.expired
                }
                type="submit"
              >
                {t.confirm}{" "}
                {new Intl.NumberFormat(language, {
                  style: "currency",
                  currency: "EUR",
                }).format(quote.totalMinor / 100)}
              </button>
            </form>
          )}
          {quote.attempt &&
            !["paid", "cancelled", "quarantined"].includes(
              quote.attempt.state,
            ) && (
              <button
                className={s.secondary}
                disabled={pending}
                onClick={cancel}
              >
                {t.cancel}
              </button>
            )}
          <button
            className={s.secondary}
            disabled={pending}
            onClick={() => {
              setWorking(false);
              router.refresh();
            }}
          >
            {t.refresh}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
