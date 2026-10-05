"use client";
import { MiniShell } from "@/features/discovery/mini-frame";
import { useLocale } from "next-intl";
import { toolCopy } from "@/features/shopping-tools/copy";
export default function Loading() {
  const t = toolCopy[useLocale() === "en" ? "en" : "bg"];
  return (
    <MiniShell name={t.hub}>
      <p role="status" className="form-note">
        {t.loading}
      </p>
    </MiniShell>
  );
}
