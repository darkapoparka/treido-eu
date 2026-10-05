"use client";
import { useFormatter, useTranslations } from "next-intl";
import { ConversationDialog } from "../messaging/dialog";
import { reviewError } from "../purchase-reviews/controls";
import { INQUIRY_STATUSES } from "./model";
import type { InquiryWorkflowView } from "./workflow-model";
import { useInquiryWorkflow } from "./use-inquiry-workflow";
import s from "../purchase-reviews/reviews.module.css";

export function InquiryWorkflow({
  initial,
  actorSubject,
}: {
  initial: InquiryWorkflowView;
  actorSubject: string;
}) {
  const t = useTranslations("contactOperations"),
    p = useTranslations("purchaseReviews"),
    format = useFormatter();
  const flow = useInquiryWorkflow(initial, actorSubject);
  const {
    current,
    access,
    sameActor,
    draft,
    invalid,
    busy,
    preview,
    conflict,
    locked,
  } = flow;
  if (!sameActor || access !== "ready")
    return (
      <section className={s.card} aria-live="polite">
        <p>
          {p(
            !sameActor || access === "denied"
              ? "denied"
              : access === "checking"
                ? "checking"
                : "failed",
          )}
        </p>
        <p className={s.muted}>{t("retainedWhileChecking")}</p>
        {sameActor && (
          <button
            className={s.secondary}
            onClick={() => void flow.refresh()}
            disabled={busy}
          >
            {t("reload")}
          </button>
        )}
      </section>
    );
  return (
    <div className={s.stack} data-inquiry-workflow>
      <section className={s.card}>
        <h2>{t("status")}</h2>
        <p>
          {t("currentStatus", {
            status: t(current.status),
            revision: current.revision,
          })}
        </p>
        <p className={s.muted}>{t("statusNote")}</p>
        {!current.canManage && <p role="status">{t("readOnly")}</p>}
        {invalid && <p role="alert">{t("invalidRecovery")}</p>}
        {flow.storageFailed && <p role="alert">{t("storageUnavailable")}</p>}
        {flow.recovered && !invalid && (
          <p className={s.muted}>{t("recovered")}</p>
        )}
        {draft.receipt && (
          <p role="status">
            {t("operationReceipt", {
              revision: draft.receipt.acceptedRevision,
              current: current.revision,
            })}
          </p>
        )}
        <label className={s.field}>
          {t("status")}
          <select
            value={draft.status}
            disabled={locked}
            onChange={(event) => {
              const status = INQUIRY_STATUSES.find(
                (value) => value === event.target.value,
              );
              if (status) flow.edit({ status });
            }}
          >
            {INQUIRY_STATUSES.map((status) => (
              <option value={status} key={status}>
                {t(status)}
              </option>
            ))}
          </select>
        </label>
        <div className={s.actions}>
          <button
            className={s.primary}
            disabled={locked || conflict || draft.status === current.status}
            onClick={() => flow.prepare("status")}
          >
            {t("saveStatus")}
          </button>
          <button
            className={s.secondary}
            disabled={busy}
            onClick={() => void flow.refresh()}
          >
            {t("reload")}
          </button>
        </div>
        <label className={s.field}>
          {t("reply")}
          <textarea
            value={draft.body}
            maxLength={4000}
            rows={6}
            disabled={locked}
            onChange={(event) => flow.edit({ body: event.target.value })}
          />
        </label>
        <p className={s.muted}>{t("replyNote")}</p>
        {!current.canReply && <p>{t("cannotReply")}</p>}
        <button
          className={s.primary}
          disabled={
            locked || conflict || !current.canReply || !draft.body.trim()
          }
          onClick={() => flow.prepare("reply")}
        >
          {t("previewReply")}
        </button>
        {draft.code && <p role="alert">{p(reviewError(draft.code))}</p>}
        {draft.attempt && (
          <div className={s.notice}>
            <p>{t(draft.rejected ? "rejectedOperation" : "uncertain")}</p>
            <p className={s.muted}>
              {t("requestReference", { id: draft.attempt.requestId })}
            </p>
            <pre className={s.preview}>
              {draft.attempt.operation.kind === "reply"
                ? draft.attempt.operation.body
                : t(draft.attempt.operation.status)}
            </pre>
            {!draft.rejected && (
              <button
                className={s.secondary}
                disabled={busy || !current.canManage}
                onClick={() => draft.attempt && void flow.submit(draft.attempt)}
              >
                {t(busy ? "saving" : "retry")}
              </button>
            )}
          </div>
        )}
        {conflict &&
          (!draft.attempt || draft.rejected) &&
          current.canManage &&
          !invalid && (
            <div className={s.notice}>
              <p>{t("conflict")}</p>
              <div className={s.actions}>
                <button
                  className={s.secondary}
                  disabled={busy}
                  onClick={() => flow.resolve(true)}
                >
                  {t("keepInput")}
                </button>
                <button
                  className={s.secondary}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t("discardConfirm")))
                      flow.resolve(false);
                  }}
                >
                  {t("loadSaved")}
                </button>
              </div>
            </div>
          )}
      </section>
      <section className={s.card}>
        <h2>{t("history")}</h2>
        <p className={s.muted}>{t("historyNote")}</p>
        {!current.history.length && <p>{t("historyEmpty")}</p>}
        <ol className={s.lines}>
          {current.history.map((event) => (
            <li key={event.revision}>
              <strong>
                {t(event.kind === "reply" ? "eventReply" : "eventStatus", {
                  from: t(event.from),
                  to: t(event.to),
                })}
              </strong>
              <p className={s.muted}>
                {format.dateTime(new Date(event.at), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {t(event.own ? "yourChange" : "teamChange")}
              </p>
            </li>
          ))}
        </ol>
      </section>
      {preview && (
        <ConversationDialog
          title={t(
            preview.operation.kind === "reply"
              ? "previewReply"
              : "confirmStatus",
          )}
          onClose={flow.closePreview}
        >
          <p>
            {t(preview.operation.kind === "reply" ? "replyNote" : "statusNote")}
          </p>
          <pre className={s.preview}>
            {preview.operation.kind === "reply"
              ? preview.operation.body
              : t(preview.operation.status)}
          </pre>
          <div className={s.actions}>
            <button
              className={s.secondary}
              disabled={busy}
              onClick={flow.closePreview}
            >
              {p("cancel")}
            </button>
            <button
              className={s.primary}
              disabled={
                busy ||
                !current.canManage ||
                (preview.operation.kind === "reply" && !current.canReply)
              }
              onClick={() => void flow.submit(preview)}
            >
              {t(
                preview.operation.kind === "reply" ? "sendReply" : "saveStatus",
              )}
            </button>
          </div>
        </ConversationDialog>
      )}
    </div>
  );
}
