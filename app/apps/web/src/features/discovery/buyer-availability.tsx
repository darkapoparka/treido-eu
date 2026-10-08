"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
export function BuyerAvailability({
  unavailable,
  home = false,
  categoryLabel,
}: {
  unavailable?: boolean;
  home?: boolean;
  categoryLabel?: string;
}) {
  const t = useTranslations("marketplace"),
    router = useRouter();
  return (
    <section className="empty-state" role="status">
      <h2>{t(unavailable ? "unavailableTitle" : "emptyTitle")}</h2>
      <p>
        {!unavailable && categoryLabel
          ? t("emptyCategory", { category: categoryLabel })
          : t(unavailable ? "unavailable" : home ? "emptyHome" : "emptySearch")}
      </p>
      {unavailable && (
        <button type="button" className="pill" onClick={() => router.refresh()}>
          {t("retry")}
        </button>
      )}
    </section>
  );
}
