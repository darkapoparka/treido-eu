"use client";
import { useLocale } from "next-intl";
import { paymentText } from "@/features/payments/messages";
export default function Error({ reset }: { reset: () => void }) {
  const t = paymentText(useLocale() === "bg" ? "bg" : "en");
  return (
    <main>
      <p role="alert">{t.failed}</p>
      <button onClick={reset}>{t.refresh}</button>
    </main>
  );
}
