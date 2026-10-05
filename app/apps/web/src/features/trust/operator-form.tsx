"use client";
import { useTranslations } from "next-intl";
import { ConversationDialog } from "../messaging/dialog";
import { useOperatorDecision } from "./use-operator-decision";
import type { ModerationContext } from "./operations-model";
import type { ModerationState } from "./moderation-model";
import styles from "../sellers/workspace.module.css";
import s from "./operations.module.css";
export function OperatorDecisionForm({
  initial,
  actorSubject,
}: {
  initial: ModerationContext;
  actorSubject: string;
}) {
  const t = useTranslations("trustOperations"),
    f = useOperatorDecision(initial, actorSubject);
  if (!f.sameActor || f.access !== "ready")
    return (
      <section className={s.card} aria-live="polite">
        <p>
          {t(
            !f.sameActor
              ? "denied"
              : f.access === "checking"
                ? "checking"
                : f.access === "denied"
                  ? "denied"
                  : "failed",
          )}
        </p>
        <button className={styles.button} onClick={f.reload}>
          {t("reload")}
        </button>
      </section>
    );
  const locked =
    f.busy || !!f.draft.attempt || !f.current.canModerate || f.invalid;
  return (
    <section className={s.card} data-operator-decision>
      <h2>{t("decision")}</h2>
      <p>
        {t("currentState", {
          state: t(f.current.state),
          revision: f.current.revision,
        })}
      </p>
      <p className={s.muted}>{t("decisionNote")}</p>
      {!f.current.canModerate && <p role="status">{t("readOnly")}</p>}
      {f.current.reportState === "reviewed" && (
        <p className={s.notice}>{t("reportReviewed")}</p>
      )}
      {f.invalid && <p role="alert">{t("invalidRecovery")}</p>}
      {f.storageFailed && <p role="alert">{t("storageFailed")}</p>}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          f.prepare();
        }}
      >
        <fieldset disabled={locked}>
          <label>
            {t("nextState")}
            <select
              value={f.draft.state}
              onChange={(event) =>
                f.edit({ state: event.target.value as ModerationState })
              }
            >
              {(["clear", "restricted", "removed"] as const).map((state) => (
                <option key={state} value={state}>
                  {t(state)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("communicatedReason")}
            <textarea
              rows={5}
              maxLength={2000}
              required
              value={f.draft.reason}
              onChange={(event) => f.edit({ reason: event.target.value })}
            />
          </label>
          <p className={s.muted}>{t("reasonPrivacy")}</p>
          <button
            className={styles.button}
            disabled={!f.canPrepare || !f.draft.reason.trim()}
          >
            {t(f.busy ? "saving" : "previewDecision")}
          </button>
        </fieldset>
      </form>
      {f.draft.receipt && (
        <p role="status">
          {t("acknowledged", {
            revision: f.draft.receipt.revision,
            current: f.current.revision,
          })}{" "}
          <span className={s.reference}>{f.draft.receipt.id}</span>
        </p>
      )}
      {f.draft.code && (
        <p role="alert">
          {t(
            f.draft.code === "INVALID_INPUT"
              ? "invalid"
              : f.draft.code === "CONFLICT"
                ? "conflict"
                : "failed",
          )}
        </p>
      )}
      {f.draft.attempt && !f.draft.rejected && (
        <div className={s.notice}>
          <p>{t("uncertain")}</p>
          <p>
            {t("frozenDecision", {
              state: t(f.draft.attempt.input.state),
              revision: f.draft.attempt.input.expectedRevision,
            })}
          </p>
          <p className={s.text}>{f.draft.attempt.input.reason}</p>
          <button
            className={styles.button}
            disabled={f.busy || !f.current.canModerate}
            onClick={() => f.draft.attempt && void f.submit(f.draft.attempt)}
          >
            {t("retrySame")}
          </button>
        </div>
      )}
      {f.conflict && (!f.draft.attempt || f.draft.rejected) && (
        <div className={s.notice}>
          <p>{t("conflict")}</p>
          <div className={s.actions}>
            <button
              className={styles.button}
              disabled={f.busy || !f.current.canModerate || f.invalid}
              onClick={() => f.resolve(true)}
            >
              {t("keepReason")}
            </button>
            <button
              className={styles.button}
              disabled={f.busy || !f.current.canModerate || f.invalid}
              onClick={() => f.resolve(false)}
            >
              {t("discardReason")}
            </button>
          </div>
        </div>
      )}
      <button className={styles.button} disabled={f.busy} onClick={f.reload}>
        {t("reload")}
      </button>
      {f.preview && (
        <ConversationDialog
          title={t("confirmDecision")}
          onClose={f.closePreview}
        >
          <p>{t("confirmNote")}</p>
          <strong>{t(f.preview.input.state)}</strong>
          <p className={s.text}>{f.preview.input.reason}</p>
          <p>{t("revision", { revision: f.preview.input.expectedRevision })}</p>
          <div className={s.actions}>
            <button
              className={styles.button}
              disabled={f.busy}
              onClick={f.closePreview}
            >
              {t("cancel")}
            </button>
            <button
              className={styles.button}
              disabled={f.busy || !f.canPrepare}
              onClick={() => f.preview && void f.submit(f.preview)}
            >
              {t("confirmSave")}
            </button>
          </div>
        </ConversationDialog>
      )}
    </section>
  );
}
