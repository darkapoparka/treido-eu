"use client";
import { useFormatter, useTranslations } from "next-intl";
import { ConversationDialog } from "../messaging/dialog";
import { useCaseDecision } from "./use-case-decision";
import {
  appealOutcomes,
  reportOutcomes,
  type CaseContext,
  type CaseDecision,
  type CaseOutcome,
} from "./case-model";
import type { ModerationState } from "./moderation-model";
import s from "./operations.module.css";
import m from "../messaging/messaging.module.css";
import w from "../sellers/workspace.module.css";

export function CaseDecisionCard({ decision }: { decision: CaseDecision }) {
  const t = useTranslations("trustCases"),
    format = useFormatter();
  return (
    <section className={s.notice}>
      <h3>{t(decision.outcome)}</h3>
      <p className={s.text}>{decision.reason}</p>
      <p>
        {t("recordedAt", {
          time: format.dateTime(new Date(decision.at), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })}
      </p>
      <p>
        {t("receiptRevision", {
          revision: decision.revision,
          resource: decision.resourceRevision,
        })}
      </p>
      <p>{t(decision.actionId ? "actionRecorded" : "noResourceAction")}</p>
      <small className={s.reference}>
        {t("reference")}: {decision.id}
      </small>
    </section>
  );
}
export function CaseDecisionForm({
  initial,
  actorSubject,
}: {
  initial: CaseContext;
  actorSubject: string;
}) {
  const t = useTranslations("trustCases"),
    c = useCaseDecision(initial, actorSubject);
  const outcomes = initial.kind === "appeal" ? appealOutcomes : reportOutcomes;
  if (!c.sameActor || c.access === "denied")
    return (
      <p role="status" className={s.notice}>
        {t("denied")}
      </p>
    );
  return (
    <section className={s.card}>
      <h2>
        {t(
          initial.kind === "appeal" ? "resolveAppeal" : "resolveMessageReport",
        )}
      </h2>
      <p>
        {t(initial.kind === "appeal" ? "appealBoundary" : "messageBoundary")}
      </p>
      <p className={s.badge}>{t(c.current.status)}</p>
      <p>
        {t("resourceState")}: {t(c.current.state)}
      </p>
      <p>
        {t("currentRevision", {
          revision: c.current.revision,
          resource: c.current.resourceRevision,
        })}
      </p>
      {!c.current.available && (
        <p role="status" className={s.notice}>
          {t("storageUnavailable")}
        </p>
      )}
      {c.access !== "ready" && (
        <p role="status">
          {t(c.access === "checking" ? "checking" : "unavailable")}
        </p>
      )}
      {c.current.available &&
        !c.current.canDecide &&
        c.current.status === "open" && <p>{t("readOnly")}</p>}
      {c.current.decision && <CaseDecisionCard decision={c.current.decision} />}
      {c.draft.receipt && (
        <div role="status">
          <h3>{t("recovered")}</h3>
          <CaseDecisionCard decision={c.draft.receipt.decision} />
        </div>
      )}
      {c.invalid ? (
        <p role="alert">{t("corrupt")}</p>
      ) : (
        <>
          <div className={m.reviewForm}>
            <label>
              {t("outcome")}
              <select
                value={c.draft.outcome}
                disabled={
                  !c.current.canDecide ||
                  !!c.draft.attempt ||
                  c.busy ||
                  c.access !== "ready"
                }
                onChange={(event) =>
                  c.edit({ outcome: event.target.value as CaseOutcome })
                }
              >
                {outcomes.map((outcome) => (
                  <option
                    key={outcome}
                    value={outcome}
                    disabled={
                      outcome === "message_hidden" &&
                      c.current.state !== "visible"
                    }
                  >
                    {t(outcome)}
                  </option>
                ))}
              </select>
            </label>
            {c.draft.outcome === "revised" && (
              <label>
                {t("newState")}
                <select
                  value={c.draft.nextState}
                  disabled={
                    !c.current.canDecide ||
                    !!c.draft.attempt ||
                    c.busy ||
                    c.access !== "ready"
                  }
                  onChange={(event) =>
                    c.edit({ nextState: event.target.value as ModerationState })
                  }
                >
                  {(["clear", "restricted", "removed"] as const).map(
                    (state) => (
                      <option
                        key={state}
                        value={state}
                        disabled={state === c.current.state}
                      >
                        {t(state)}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}
            <label>
              {t("reason")}
              <textarea
                rows={5}
                maxLength={2000}
                value={c.draft.reason}
                disabled={
                  !c.current.canDecide ||
                  !!c.draft.attempt ||
                  c.busy ||
                  c.access !== "ready"
                }
                onChange={(event) => c.edit({ reason: event.target.value })}
              />
            </label>
            <p className={s.muted}>{t("privacy")}</p>
          </div>
          {c.storageFailed && <p role="alert">{t("storageFailed")}</p>}
          {c.draft.code && (
            <p role="alert">{t(c.draft.rejected ? "rejected" : "uncertain")}</p>
          )}
          {c.draft.attempt && !c.draft.rejected && (
            <div className={s.notice}>
              <p>{t("pending")}</p>
              <small>
                {t("reference")}: {c.draft.attempt.requestId}
              </small>
              <button
                className={w.button}
                disabled={c.busy || c.access !== "ready"}
                onClick={() => void c.submit(c.draft.attempt!)}
              >
                {t("retryOriginal")}
              </button>
            </div>
          )}
          {c.conflict && (!c.draft.attempt || c.draft.rejected) && (
            <div className={s.notice}>
              <p>{t("conflict")}</p>
              <div className={s.actions}>
                <button
                  className={w.button}
                  disabled={c.busy || c.access !== "ready"}
                  onClick={() => c.resolve(true)}
                >
                  {t("keepReason")}
                </button>
                <button
                  className={w.button}
                  disabled={c.busy || c.access !== "ready"}
                  onClick={() => c.resolve(false)}
                >
                  {t("discard")}
                </button>
              </div>
            </div>
          )}
          <div className={s.actions}>
            <button className={w.button} disabled={c.busy} onClick={c.reload}>
              {t("reload")}
            </button>
            <button
              className={w.button}
              disabled={!c.canPrepare || !c.draft.reason.trim()}
              onClick={c.prepare}
            >
              {t("preview")}
            </button>
          </div>
        </>
      )}
      {c.preview && (
        <ConversationDialog title={t("confirmTitle")} onClose={c.closePreview}>
          <h3>{t(c.preview.outcome)}</h3>
          {c.preview.nextState && <p>{t(c.preview.nextState)}</p>}
          <p className={s.text}>{c.preview.reason}</p>
          <p>
            {t("currentRevision", {
              revision: c.preview.expectedRevision,
              resource: c.preview.expectedResourceRevision,
            })}
          </p>
          <p className={s.reference}>
            {t("resource")}: {c.preview.resourceId}
          </p>
          <p className={s.reference}>
            {t("caseReference")}: {c.preview.caseId}
          </p>
          {c.preview.originalActionId && (
            <p className={s.reference}>
              {t("originalDecision")}: {c.preview.originalActionId}
            </p>
          )}
          <p>{t("immutable")}</p>
          <footer>
            <button
              className={m.button}
              disabled={c.busy}
              onClick={c.closePreview}
            >
              {t("cancel")}
            </button>
            <button
              className={m.button + " " + m.primary}
              disabled={!c.canPrepare}
              onClick={() => void c.submit(c.preview!)}
            >
              {t("confirm")}
            </button>
          </footer>
        </ConversationDialog>
      )}
    </section>
  );
}
