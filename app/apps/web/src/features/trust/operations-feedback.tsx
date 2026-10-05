"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import w from "../sellers/workspace.module.css";
export function OperationsRefresh({
  className = w.button,
}: {
  className?: string;
}) {
  const router = useRouter(),
    t = useTranslations("trustOperations");
  return (
    <button
      type="button"
      className={className}
      onClick={() => router.refresh()}
    >
      {t("reload")}
    </button>
  );
}
export function OperationsError({ reset }: { reset: () => void }) {
  const t = useTranslations("trustOperations");
  return (
    <section className={w.page}>
      <h1>{t("reports")}</h1>
      <p role="alert">{t("failed")}</p>
      <button className={w.button} onClick={reset}>
        {t("reload")}
      </button>
    </section>
  );
}
