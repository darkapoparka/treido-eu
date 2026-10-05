"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useContactRecovery } from "../purchase-reviews/contact-recovery";
import {
  emptyAppealDraft,
  parseAppealDraft,
  parseAppealSubmission,
  parseAppealAcknowledgment,
  type AppealSubmission,
} from "./appeal-submission-model";
import { submitRecoverableAppealAction } from "./appeal-submission-actions";
import s from "../messaging/messaging.module.css";

export function AppealComposer({
  actionId,
  actorKey,
  actorSubject,
}: {
  actionId: string;
  actorKey: string;
  actorSubject: string;
}) {
  const t = useTranslations("trustCases"),
    locale = useLocale(),
    router = useRouter();
  const clerk = useClerk(),
    { isLoaded, user } = useUser();
  const recovery = useContactRecovery(
    "appeal-submission:" + actorKey + ":" + actionId,
  );
  const { draft, invalid } = parseAppealDraft(recovery.raw, actionId);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [storageFailed, setStorageFailed] = useState(false);
  const life = useRef({ mounted: true, busy: false });
  const sameActor = isLoaded && user?.id === actorSubject;
  useEffect(() => {
    const scope = life.current;
    scope.mounted = true;
    return () => {
      scope.mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!storageFailed && !draft.details && !draft.pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [storageFailed, draft.details, draft.pending]);
  async function submit(input: AppealSubmission) {
    if (
      life.current.busy ||
      !sameActor ||
      clerk.user?.id !== actorSubject ||
      invalid
    )
      return;
    const next = {
      ...draft,
      details: input.details,
      pending: input,
      receipt: null,
      rejected: false,
      code: null,
    };
    if (!recovery.write(next)) {
      recovery.write(draft);
      setStorageFailed(true);
      return;
    }
    setStorageFailed(false);
    life.current.busy = true;
    setBusy(true);
    try {
      const result = await submitRecoverableAppealAction({ actorKey, input });
      if (clerk.user?.id !== actorSubject) return;
      if (result.ok) {
        const receipt = parseAppealAcknowledgment(result.data, input);
        recovery.write(
          receipt
            ? { ...emptyAppealDraft, receipt }
            : { ...next, code: "NOT_AVAILABLE" },
        );
      } else
        recovery.write({
          ...next,
          rejected: result.rejected,
          code: result.code,
        });
      if (life.current.mounted) router.refresh();
    } catch {
      if (clerk.user?.id === actorSubject)
        recovery.write({ ...next, code: "NOT_AVAILABLE" });
    } finally {
      life.current.busy = false;
      if (life.current.mounted) setBusy(false);
    }
  }
  if (!sameActor) return <p role="status">{t("denied")}</p>;
  if (invalid) return <p role="alert">{t("corrupt")}</p>;
  if (draft.receipt)
    return (
      <p role="status">
        {t("appealSubmitted")} ·{" "}
        <Link
          href={"/messages/appeals/" + draft.receipt.id + "?lang=" + locale}
        >
          {t("openAppeal")}
        </Link>
      </p>
    );
  if (!open && !draft.details && !draft.pending)
    return (
      <button className={s.button} onClick={() => setOpen(true)}>
        {t("appealSend")}
      </button>
    );
  return (
    <form
      className={s.reviewForm}
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.pending || draft.rejected) return;
        const input = parseAppealSubmission({
          actionId,
          requestId: crypto.randomUUID(),
          details: draft.details,
        });
        if (input) void submit(input);
      }}
    >
      <p>{t("appealDraftNote")}</p>
      <label>
        {t("appealDraft")}
        <textarea
          required
          rows={5}
          maxLength={2000}
          value={draft.details}
          disabled={busy || !!draft.pending}
          onChange={(event) =>
            setStorageFailed(
              !recovery.write({
                ...draft,
                details: event.target.value,
                code: null,
              }),
            )
          }
        />
      </label>
      {storageFailed && <p role="alert">{t("storageFailed")}</p>}
      {draft.code && (
        <p role="alert">{t(draft.rejected ? "appealConflict" : "uncertain")}</p>
      )}
      {draft.pending && (
        <small>
          {t("reference")}: {draft.pending.requestId}
        </small>
      )}
      <div className={s.actions}>
        {draft.pending && !draft.rejected ? (
          <button
            type="button"
            disabled={busy}
            className={s.button}
            onClick={() => void submit(draft.pending!)}
          >
            {t("appealRetry")}
          </button>
        ) : draft.rejected ? (
          <>
            <button
              type="button"
              className={s.button}
              disabled={busy}
              onClick={() =>
                recovery.write({ ...emptyAppealDraft, details: draft.details })
              }
            >
              {t("keepAppeal")}
            </button>
            <button
              type="button"
              className={s.button}
              disabled={busy}
              onClick={() => recovery.write(emptyAppealDraft)}
            >
              {t("discard")}
            </button>
          </>
        ) : (
          <button
            disabled={busy || !draft.details.trim()}
            className={s.button + " " + s.primary}
          >
            {t(busy ? "sending" : "appealSend")}
          </button>
        )}
      </div>
    </form>
  );
}
