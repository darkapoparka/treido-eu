"use client";
import { useLocale } from "@/features/locale/provider";
import { useSearchParams } from "next/navigation";
import { parseLocale } from "@/features/locale/locale";
import { promotionCopy } from "@/features/promotions/copy";
export default function PromotionError({ reset }: { reset: () => void }) {
  const locale = useLocale(),
    params = useSearchParams(),
    c = promotionCopy(parseLocale(params.get("lang")) ?? locale.locale);
  return (
    <section role="alert">
      <p>{c.ui.failed}</p>
      <button onClick={reset}>{c.ui.retry}</button>
    </section>
  );
}
