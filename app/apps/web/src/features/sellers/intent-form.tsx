"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { completeSignupIntentAction } from "./setup-actions";
import type { SignupIntentView } from "./setup-model";
import styles from "./workspace.module.css";

export function SignupIntentForm({
  initial,
  requestId,
  language,
  actorSubject,
}: {
  initial: SignupIntentView;
  requestId: string;
  language: "bg" | "en";
  actorSubject: string;
}) {
  const [result, action, pending] = useActionState(
    completeSignupIntentAction,
    null,
  );
  const bg = language === "bg";
  const clerk = useClerk();
  const router = useRouter();
  useEffect(() => {
    if (
      !result?.ok ||
      clerk.user?.id !== actorSubject ||
      location.pathname !== "/app/intent"
    )
      return;
    router.push(
      result.data.intent === "business"
        ? `/app/onboarding?lang=${language}`
        : result.data.intent === "personal"
          ? `/sell?lang=${language}`
          : result.data.intent === "buy"
            ? "/"
            : `/app?lang=${language}`,
    );
  }, [result, clerk, actorSubject, router, language]);
  return (
    <form action={action} className={`account-form ${styles.form}`}>
      <input type="hidden" name="revision" value={initial.revision} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="lang" value={language} />
      <p>
        {bg
          ? "Може да купувате, да продавате лични вещи и да управлявате бизнес с един профил. Изборът може да се промени."
          : "You can buy, sell personal items and run a business with one account. You can change this choice later."}
      </p>
      <fieldset disabled={pending} className={styles.form}>
        <legend className={styles.legend}>
          {bg
            ? "Какво искате да направите първо?"
            : "What would you like to do first?"}
        </legend>
        {(
          [
            ["buy", bg ? "Да пазарувам" : "Buy"],
            ["personal", bg ? "Да продам лични вещи" : "Sell my items"],
            ["business", bg ? "Да създам бизнес" : "Set up a business"],
          ] as const
        ).map(([intent, label]) => (
          <label key={intent} className={styles.checkbox}>
            <input
              type="radio"
              name="intent"
              value={intent}
              defaultChecked={initial.intent === intent}
            />
            <span>{label}</span>
          </label>
        ))}
        <div className={styles.actions}>
          <button className={styles.button}>
            {pending
              ? bg
                ? "Запазване…"
                : "Saving…"
              : bg
                ? "Продължи"
                : "Continue"}
          </button>
          <button type="submit" name="skip" value="yes" className={styles.link}>
            {bg ? "Пропусни засега" : "Skip for now"}
          </button>
        </div>
      </fieldset>
      {result && !result.ok && (
        <p className="form-error" role="alert">
          {result.code === "CONFLICT"
            ? bg
              ? "Изборът е променен в друга сесия. Заредете страницата отново."
              : "Your choice changed in another session. Reload this page."
            : bg
              ? "Изберете опция или пропуснете. Ако запазването не е достъпно, опитайте по-късно."
              : "Choose an option or skip. If saving is unavailable, try again later."}
        </p>
      )}
      <Link href={`/app?lang=${language}`} className={styles.link}>
        {bg ? "Към моите продажби" : "Go to My selling"}
      </Link>
    </form>
  );
}
