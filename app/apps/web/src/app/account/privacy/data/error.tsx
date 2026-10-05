"use client";
import { useLocale } from "next-intl";
import { privacyCopy } from "../../../../features/account-privacy/copy";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = privacyCopy[useLocale() === "en" ? "en" : "bg"];
  return (
    <main>
      <p role="alert">{t.unavailable}</p>
      <button onClick={reset}>{t.refresh}</button>
    </main>
  );
}
