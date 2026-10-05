"use client";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { validId } from "../selling/draft-model";
import { createPurchaseReviewAction } from "./actions";
import type { ReviewSource } from "./model";
import s from "./reviews.module.css";
export function reviewError(code: string) {
  return code === "CONFLICT"
    ? "conflict"
    : code === "INVALID_INPUT"
      ? "invalid"
      : code === "QUOTA_EXCEEDED"
        ? "limit"
        : ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(code)
          ? "denied"
          : "failed";
}
export function PrivatePurchaseBoundary({
  actorSubject,
  children,
}: {
  actorSubject: string;
  children: ReactNode;
}) {
  const { isLoaded, user } = useUser(),
    router = useRouter(),
    t = useTranslations("purchaseReviews");
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
    return <p role="status">{t(!isLoaded ? "checking" : "denied")}</p>;
  return children;
}
export function CreateReviewButton({
  source,
  actorKey,
  disabled = false,
}: {
  source: ReviewSource;
  actorKey: string;
  disabled?: boolean;
}) {
  const t = useTranslations("purchaseReviews"),
    locale = useLocale(),
    router = useRouter(),
    clerk = useClerk();
  const [handover, setHandover] = useState<"pickup" | "shipping">("pickup"),
    [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null);
  const attempt = useRef<{ scope: string; requestId: string } | null>(null),
    life = useRef({ mounted: true, busy: false });
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
    };
  }, []);
  function create() {
    if (disabled || life.current.busy || !clerk.user?.id) return;
    const actorSubject = clerk.user.id,
      language = locale === "bg" ? "bg" : "en";
    const scope =
      "treido-review-v1:" +
      actorKey +
      ":" +
      JSON.stringify({ source, handover, language });
    if (attempt.current?.scope !== scope) {
      let saved: string | null = null;
      try {
        saved = sessionStorage.getItem(scope);
      } catch {}
      attempt.current = {
        scope,
        requestId: saved && validId(saved) ? saved : crypto.randomUUID(),
      };
      try {
        sessionStorage.setItem(scope, attempt.current.requestId);
      } catch {}
    }
    const requestId = attempt.current.requestId;
    life.current.busy = true;
    setError(null);
    start(async () => {
      try {
        const result = await createPurchaseReviewAction({
          actorKey,
          source,
          handover,
          language,
          requestId,
        });
        if (!life.current.mounted || clerk.user?.id !== actorSubject) return;
        if (!result.ok) {
          setError(result.code);
          return;
        }
        try {
          sessionStorage.removeItem(scope);
        } catch {}
        attempt.current = null;
        router.push(
          "/checkout/reviews/" + result.data.id + "?lang=" + language,
        );
      } catch {
        if (life.current.mounted) setError("NOT_AVAILABLE");
      } finally {
        life.current.busy = false;
      }
    });
  }
  return (
    <div className={s.create}>
      <label className={s.field}>
        {t("handover")}
        <select
          disabled={pending}
          value={handover}
          onChange={(event) =>
            setHandover(event.target.value as "pickup" | "shipping")
          }
        >
          <option value="pickup">{t("pickup")}</option>
          <option value="shipping">{t("shipping")}</option>
        </select>
      </label>
      <button
        type="button"
        className={s.primary}
        disabled={disabled || pending}
        onClick={create}
      >
        {t(pending ? "saving" : "create")}
      </button>
      <small className={s.muted}>{t("handoverNote")}</small>
      {error && <p role="alert">{t(reviewError(error))}</p>}
      {error && (
        <Link href={"/checkout/reviews?lang=" + locale}>{t("recover")}</Link>
      )}
    </div>
  );
}
export function BuyerReviewLinks() {
  const t = useTranslations("purchaseReviews"),
    locale = useLocale();
  return (
    <nav className={s.actions} aria-label={t("title")}>
      <Link className={s.secondary} href={"/checkout/reviews?lang=" + locale}>
        {t("title")}
      </Link>
      <Link className={s.secondary} href={"/reservations?lang=" + locale}>
        {t("reservations")}
      </Link>
    </nav>
  );
}
