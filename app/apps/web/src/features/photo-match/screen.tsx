"use client";
import { useAuth } from "@clerk/nextjs";
import { MiniShell } from "../discovery/mini-frame";
import { SourceLink } from "../discovery/return-navigation";
import { AssistantNavigation } from "../assistant-tools/common-ui";
import { parseToolIntent, toolHref } from "../shopping-tools/intent";
import { toolCopy } from "../shopping-tools/copy";
import { ComparisonProvider } from "../shopping-tools/comparison-provider";
import { AssistantInterpretInput } from "../assistant-runs/interpreted-intent";
import { inputCopy } from "../assistant-runs/copy";
import { parseAssistantInputContinuation } from "./continuation";
import s from "./photo.module.css";
export function InputScreen({
  inputMode,
  locale,
  continuation,
}: {
  inputMode: "photo" | "voice";
  locale: "bg" | "en";
  continuation: string;
}) {
  const { isLoaded, userId } = useAuth(),
    t = inputCopy[locale],
    path =
      inputMode === "photo" ? "/minis/photo-match" : "/minis/find-for-me/voice",
    validated = parseAssistantInputContinuation(continuation),
    destination = validated?.startsWith(path + "?")
      ? validated
      : path + "?lang=" + locale,
    initial = parseToolIntent(
      inputMode === "voice"
        ? destination.slice(destination.indexOf("?") + 1)
        : "lang=" + locale + "&availability=known",
      "find-for-me",
    );
  return (
    <ComparisonProvider>
      <MiniShell name={t.titles[inputMode]}>
        <section className={s.content}>
          <h1>{t.titles[inputMode]}</h1>
          <AssistantNavigation />
          {inputMode === "voice" && (
            <div className={s.actions}>
              <SourceLink
                className={s.button}
                preserveDiscoveryContext={false}
                href={toolHref("find-for-me", initial)}
              >
                {toolCopy[locale].find}
              </SourceLink>
            </div>
          )}
          {!isLoaded || !userId ? (
            <>
              <p role="status">{isLoaded ? t.guest : "…"}</p>
              {isLoaded && (
                <SourceLink
                  preserveDiscoveryContext={false}
                  href={
                    "/sign-in?lang=" +
                    locale +
                    "&next=" +
                    encodeURIComponent(destination)
                  }
                >
                  {t.signIn}
                </SourceLink>
              )}
            </>
          ) : (
            <AssistantInterpretInput
              initial={initial}
              locale={locale}
              mode={inputMode}
            />
          )}
        </section>
      </MiniShell>
    </ComparisonProvider>
  );
}
