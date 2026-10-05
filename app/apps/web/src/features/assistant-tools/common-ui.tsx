"use client";
import { useAuth } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import { MiniShell } from "../discovery/mini-frame";
import { SourceLink } from "../discovery/return-navigation";
import { assistantCopy, type AssistantLocale } from "./copy";
import type { AssistantFeedback as AssistantFeedbackCode } from "./use-assistant-command";
import { parseAssistantContinuation } from "./continuation";
import s from "./assistant-tools.module.css";
export function useAssistantLocale(): AssistantLocale {
  return useLocale() === "en" ? "en" : "bg";
}
export function AssistantSession({
  kind,
  continuation,
  children,
}: {
  kind: "compatibility" | "sellHelper";
  continuation: string;
  children: (subject: string) => ReactNode;
}) {
  const { isLoaded, userId } = useAuth(),
    locale = useAssistantLocale(),
    t = assistantCopy[locale];
  if (!isLoaded || !userId)
    return (
      <MiniShell name={t[kind]}>
        <main className={s.content}>
          <h1>{t[kind]}</h1>
          <p role="status">{isLoaded ? t.guest : t.loading}</p>
          {isLoaded && (
            <SourceLink
              preserveDiscoveryContext={false}
              href={
                "/sign-in?next=" +
                encodeURIComponent(
                  parseAssistantContinuation(continuation) ??
                    "/minis/" +
                      (kind === "sellHelper" ? "sell-helper" : "compatibility"),
                ) +
                "&lang=" +
                locale
              }
            >
              {t.signIn}
            </SourceLink>
          )}
        </main>
      </MiniShell>
    );
  return children(userId);
}
export function AssistantFeedback({
  status,
  feedback,
  pending,
  busy,
  retry,
  reload,
}: {
  status: "checking" | "ready" | "denied" | "unavailable";
  feedback: AssistantFeedbackCode;
  pending: boolean;
  busy: boolean;
  retry: () => void;
  reload: () => void;
}) {
  const locale = useAssistantLocale(),
    t = assistantCopy[locale];
  return (
    <div className={s.feedback} aria-live="polite">
      {status !== "ready" && (
        <p role={status === "checking" ? "status" : "alert"}>
          {status === "checking" ? t.loading : t[status]}
        </p>
      )}
      {feedback && (
        <p role={feedback === "saved" ? "status" : "alert"}>{t[feedback]}</p>
      )}
      {pending && <p>{t.pending}</p>}
      <div className={s.actions}>
        {pending && (
          <button
            type="button"
            className={s.button}
            disabled={busy}
            onClick={retry}
          >
            {t.retry}
          </button>
        )}
        <button
          type="button"
          className={s.button}
          disabled={busy}
          onClick={reload}
        >
          {t.reload}
        </button>
      </div>
    </div>
  );
}
export function AssistantNavigation() {
  const locale = useAssistantLocale(),
    t = assistantCopy[locale];
  return (
    <nav className={s.actions}>
      <SourceLink
        preserveDiscoveryContext={false}
        href={"/minis?lang=" + locale}
      >
        {t.hub}
      </SourceLink>
      <SourceLink
        preserveDiscoveryContext={false}
        href={"/saved?lang=" + locale}
      >
        {t.viewSaved}
      </SourceLink>
    </nav>
  );
}
