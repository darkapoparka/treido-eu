"use client";
import { useAuth } from "@clerk/nextjs";
import { MiniShell } from "../discovery/mini-frame";
import { SourceLink } from "../discovery/return-navigation";
import { AssistantNavigation } from "../assistant-tools/common-ui";
import { parseToolIntent } from "../shopping-tools/intent";
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
    initial = parseToolIntent(
      "lang=" + locale + "&availability=known",
      "find-for-me",
    );
  return (
    <ComparisonProvider>
      <MiniShell name={t.titles[inputMode]}>
        <section className={s.content}>
          <h1>{t.titles[inputMode]}</h1>
          <AssistantNavigation />
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
                    encodeURIComponent(
                      parseAssistantInputContinuation(continuation) ??
                        "/minis/photo-match?lang=" + locale,
                    )
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
