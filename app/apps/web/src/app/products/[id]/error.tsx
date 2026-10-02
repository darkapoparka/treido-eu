"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
export default function ProductError({ reset }: { reset: () => void }) {
  const t = useTranslations("publication"),
    locale = useLocale();
  return (
    <main className="shop-page account-page">
      <h1>{t("missing")}</h1>
      <p role="alert">{t("unavailable")}</p>
      <button type="button" className="primary" onClick={reset}>
        {t("retry")}
      </button>
      <p>
        <Link href={"/?lang=" + locale}>{t("back")}</Link>
      </p>
    </main>
  );
}
