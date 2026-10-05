"use client";
import { useEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Locale } from "../locale/locale";
import { useUnsavedChanges } from "../sellers/use-unsaved-changes";
import { useReplyDraft } from "./use-reply-draft";
import s from "./messaging.module.css";
import { useAttachments } from "../message-attachments/use-attachments";
import { AttachmentPicker } from "../message-attachments/controls";
export function ReplyComposer({
  actorSubject,
  sellerId,
  threadId,
  canReply,
  language,
  onSent,
}: {
  actorSubject: string;
  sellerId: string | null;
  threadId: string;
  canReply: boolean;
  language: Locale;
  onSent: () => void;
}) {
  const t = useTranslations("messaging"),
    format = useFormatter(),
    input = useRef<HTMLTextAreaElement>(null);
  const attachments = useAttachments({ sellerId, threadId }, actorSubject);
  const reply = useReplyDraft(
    { actorSubject, sellerId, threadId },
    canReply,
    () => {
      attachments.clear();
      onSent();
    },
    { ids: attachments.ids, ready: attachments.ready },
  );
  useUnsavedChanges(
    !!reply.draft.body.trim() ||
      !!reply.draft.attempt ||
      reply.storageFailed ||
      !!attachments.items.length,
    language,
  );
  const acknowledgment = reply.acknowledgment,
    busy = reply.busy;
  const recoveredAttachmentIds = (
    reply.draft.attempt?.attachmentIds ?? []
  ).join(",");
  const recoverAttachments = attachments.recover;
  useEffect(() => {
    recoverAttachments(
      recoveredAttachmentIds ? recoveredAttachmentIds.split(",") : [],
    );
  }, [recoveredAttachmentIds, recoverAttachments]);
  // A stored historical receipt must not open the keyboard on navigation.
  // Focus returns only after an explicit send/recovery finishes in this mount.
  useEffect(() => {
    if (acknowledgment > 0 && !busy) input.current?.focus();
  }, [acknowledgment, busy]);
  if (!reply.sameActor) return <p role="status">{t("checking")}</p>;
  return (
    <form
      className={s.composer}
      onSubmit={(event) => {
        event.preventDefault();
        void reply.send();
      }}
      data-recoverable-reply
    >
      {!canReply && <p className={s.notice}>{t("replyUnavailable")}</p>}
      {reply.recovered && !!reply.draft.body && (
        <p className={s.muted}>{t("replyRecovered")}</p>
      )}
      {reply.invalid && (
        <p className={s.error} role="alert">
          {t("replyInvalidRecovery")}
        </p>
      )}
      {reply.storageFailed && (
        <p className={s.error} role="alert">
          {t("replyStorageFailed")}
        </p>
      )}
      <label htmlFor={"message-" + threadId}>{t("write")}</label>
      <textarea
        ref={input}
        id={"message-" + threadId}
        value={reply.draft.body}
        maxLength={4000}
        disabled={reply.busy || !!reply.draft.attempt || reply.invalid}
        onChange={(event) => reply.edit(event.target.value)}
      />
      {reply.draft.attempt && (
        <p className={s.notice} role="status">
          {t(reply.draft.rejected ? "replyRejected" : "replyUncertain")}
        </p>
      )}
      <AttachmentPicker
        controller={attachments}
        scope={{ sellerId, threadId }}
        language={language}
        disabled={
          !canReply || reply.busy || !!reply.draft.attempt || reply.invalid
        }
      />
      {reply.draft.code && (
        <p role="alert" className={s.error}>
          {t(
            reply.draft.code === "QUOTA_EXCEEDED"
              ? "sendLimit"
              : reply.draft.code === "CONFLICT"
                ? "sendConflict"
                : "sendFailed",
          )}
        </p>
      )}
      <div className={s.composerFooter}>
        <span role="status" className={s.muted}>
          {reply.draft.receipt
            ? t(reply.draft.receipt.recovered ? "replyAcknowledged" : "sent")
            : format.number(reply.draft.body.length) +
              " / " +
              format.number(4000)}
        </span>
        {reply.draft.rejected ? (
          <button
            type="button"
            className={s.button}
            disabled={reply.busy}
            onClick={reply.editRejected}
          >
            {t("replyEditRejected")}
          </button>
        ) : (
          <button
            className={s.button + " " + s.primary}
            disabled={reply.disabled}
          >
            {t(
              reply.busy
                ? "sending"
                : reply.draft.attempt
                  ? "replyRetry"
                  : "send",
            )}
          </button>
        )}
      </div>
    </form>
  );
}
