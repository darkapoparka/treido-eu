"use client";
import { useTranslations } from "next-intl";
import s from "../purchase-reviews/reviews.module.css";
export function NotificationError({ reset }: { reset: () => void }) {
  const t = useTranslations("notifications");
  return (
    <section className={s.card}>
      <h2>{t("title")}</h2>
      <p role="alert">{t("unavailable")}</p>
      <button className={s.secondary} onClick={reset}>
        {t("reload")}
      </button>
    </section>
  );
}
