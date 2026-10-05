"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useClerk } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { INSIGHT_LIMITS } from "./model";
import { insightCopy, type InsightLanguage } from "./copy";
import s from "./insights.module.css";

export function RefreshInsights({ language }: { language: InsightLanguage }) {
  const router = useRouter(),
    [pending, start] = useTransition(),
    { ui } = insightCopy(language);
  return (
    <button
      className={s.button}
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      {pending ? ui.loading : ui.retry}
    </button>
  );
}
export function ExportInsights({
  language,
  actorSubject,
  href,
  enabled,
}: {
  language: InsightLanguage;
  actorSubject: string;
  href: string;
  enabled: boolean;
}) {
  const clerk = useClerk(),
    { ui } = insightCopy(language);
  const [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<string | null>(null);
  const life = useRef<{ mounted: boolean; controller: AbortController | null }>(
    { mounted: true, controller: null },
  );
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.controller?.abort();
    };
  }, []);
  async function download() {
    if (!enabled || life.current.controller) return;
    if (clerk.user?.id !== actorSubject) {
      setFeedback(ui.denied);
      return;
    }
    const controller = new AbortController();
    life.current.controller = controller;
    setBusy(true);
    setFeedback(null);
    const valid = () =>
      life.current.mounted &&
      !controller.signal.aborted &&
      clerk.user?.id === actorSubject;
    try {
      const response = await fetch(href, {
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        signal: controller.signal,
        headers: { Accept: "text/csv" },
      });
      if (!valid()) return;
      if (!response.ok) {
        setFeedback(
          response.status === 413
            ? ui.exportLimit
            : response.status === 401 || response.status === 403
              ? ui.denied
              : response.status === 400
                ? ui.invalid
                : ui.failed,
        );
        return;
      }
      if (!response.headers.get("content-type")?.startsWith("text/csv")) {
        setFeedback(ui.failed);
        return;
      }
      const blob = await response.blob();
      if (!valid()) return;
      if (blob.size > INSIGHT_LIMITS.exportBytes) {
        setFeedback(ui.exportLimit);
        return;
      }
      const header = response.headers.get("content-disposition") ?? "";
      const name =
        /filename="(treido-[a-z0-9_-]+\.csv)"/.exec(header)?.[1] ??
        "treido-insights.csv";
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback(ui.exported);
    } catch {
      if (valid()) setFeedback(ui.failed);
    } finally {
      if (life.current.controller === controller)
        life.current.controller = null;
      if (life.current.mounted) setBusy(false);
    }
  }
  return (
    <div className={s.stack}>
      <button
        className={s.button}
        type="button"
        disabled={!enabled || busy}
        onClick={download}
      >
        {busy ? ui.exporting : ui.export}
      </button>
      {!enabled && <p className={s.muted}>{ui.exportUnavailable}</p>}
      {feedback && <p role="status">{feedback}</p>}
    </div>
  );
}
export function InsightsLoading() {
  const locale = useLocale(),
    { ui } = insightCopy(locale === "bg" ? "bg" : "en");
  return (
    <section className={s.root} aria-busy="true">
      <p role="status">{ui.loading}</p>
    </section>
  );
}
export function InsightsError({ reset }: { reset: () => void }) {
  const locale = useLocale(),
    { ui } = insightCopy(locale === "bg" ? "bg" : "en");
  return (
    <section className={s.root}>
      <h1>{ui.title}</h1>
      <p role="alert">{ui.failed}</p>
      <button className={s.button} onClick={reset}>
        {ui.retry}
      </button>
    </section>
  );
}
