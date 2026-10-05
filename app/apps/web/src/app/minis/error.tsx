"use client";
import { MiniShell } from "@/features/discovery/mini-frame";
import { useLocale } from "next-intl";
import { toolCopy } from "@/features/shopping-tools/copy";
export default function ErrorBoundary({ reset }: { reset: () => void }) {
  const t = toolCopy[useLocale() === "en" ? "en" : "bg"];
  return (
    <MiniShell name={t.hub}>
      <p role="alert" className="form-note">
        {t.unavailable}
      </p>
      <button className="pill" onClick={reset}>
        {t.retry}
      </button>
    </MiniShell>
  );
}
