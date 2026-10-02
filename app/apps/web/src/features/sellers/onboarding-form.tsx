"use client";
import { useActionState, useEffect, useRef } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { createBusinessAction } from "./actions";
import styles from "./workspace.module.css";

export function BusinessOnboardingForm({
  requestId,
  language,
  actorSubject,
}: {
  requestId: string;
  language: "bg" | "en";
  actorSubject: string;
}) {
  const [result, action, pending] = useActionState(createBusinessAction, null);
  const bg = language === "bg";
  const clerk = useClerk();
  const router = useRouter();
  const next = useRef("item");
  useEffect(() => {
    if (
      !result?.ok ||
      clerk.user?.id !== actorSubject ||
      location.pathname !== "/app/onboarding"
    )
      return;
    router.push(
      `/app/sellers/${result.data}/${next.current === "setup" ? "onboarding" : "listings/new"}?lang=${language}`,
    );
  }, [result, clerk, actorSubject, router, language]);
  return (
    <form
      action={action}
      className={`account-form ${styles.form}`}
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        next.current =
          submitter instanceof HTMLButtonElement && submitter.name === "setup"
            ? "setup"
            : "item";
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="lang" value={language} />
      <label className="form-field">
        {bg ? "Име на бизнеса" : "Business name"}
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="organization"
        />
      </label>
      <p className="form-note">
        {bg
          ? "Първо създайте чернова. Данните за търговец, доставка и плащания се попълват преди съответните операции."
          : "Start with a draft. Trader details, delivery and payment setup are completed before the operations that need them."}
      </p>
      {result && !result.ok && (
        <p role="alert" className="form-error">
          {result.code === "CONFLICT"
            ? bg
              ? "Този опит може вече да е създал бизнес. Проверете Моите продажби преди нов опит."
              : "This attempt may already have created a business. Check My selling before starting another."
            : bg
              ? "Бизнесът не беше създаден. Проверете данните и опитайте отново."
              : "The business could not be created. Check your details and try again."}
        </p>
      )}
      <button className={styles.button} disabled={pending}>
        {pending
          ? bg
            ? "Създаване…"
            : "Creating…"
          : bg
            ? "Създай бизнес и първи артикул"
            : "Create business and first item"}
      </button>
      <button
        type="submit"
        name="setup"
        className={styles.link}
        disabled={pending}
      >
        {bg
          ? "Създай бизнес и попълни данните"
          : "Create business and complete details"}
      </button>
    </form>
  );
}
