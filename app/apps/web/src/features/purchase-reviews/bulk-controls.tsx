"use client";
import { useTranslations } from "next-intl";
import { ConversationDialog } from "../messaging/dialog";
import { reviewError } from "./controls";
import { CANCELLATION_BATCH_LIMIT } from "./bulk-model";
import { retryableCancellation } from "./bulk-recovery";
import type { ReservationItem } from "./reservation-model";
import type { ReservationBatchController as Controller } from "./use-reservation-batch";
export { useReservationBatch } from "./use-reservation-batch";
import s from "./reviews.module.css";
import b from "./bulk-controls.module.css";
export function ReservationBatchCheckbox({
  row,
  batch,
}: {
  row: ReservationItem;
  batch: Controller;
}) {
  const t = useTranslations("contactOperations");
  const checked = batch.draft.entries.some(
    (entry) => entry.row.allocationId === row.id,
  );
  if (
    !batch.sameActor ||
    batch.access !== "ready" ||
    (!row.canCancel && !checked)
  )
    return null;
  return (
    <label className={b.selection}>
      <input
        type="checkbox"
        checked={checked}
        disabled={
          !batch.canSelect ||
          (!checked && batch.draft.entries.length >= CANCELLATION_BATCH_LIMIT)
        }
        onChange={() => batch.toggle(row)}
      />
      <span>
        {t("selectReservation", {
          title: row.lines[0]?.title ?? row.sellerName,
        })}
      </span>
    </label>
  );
}
export function ReservationBatchPanel({ batch }: { batch: Controller }) {
  const t = useTranslations("contactOperations"),
    p = useTranslations("purchaseReviews");
  const { draft } = batch;
  if (!batch.sameActor || batch.access !== "ready")
    return (
      <section className={s.card} aria-live="polite">
        <p>
          {p(
            !batch.sameActor || batch.access === "denied"
              ? "denied"
              : batch.access === "checking"
                ? "checking"
                : "failed",
          )}
        </p>
        <p className={s.muted}>{t("batchRetained")}</p>
        {batch.sameActor && (
          <button
            className={s.secondary}
            disabled={batch.busy}
            onClick={() => void batch.reloadAccess()}
          >
            {t("reload")}
          </button>
        )}
      </section>
    );
  const unresolved = draft.submitted
    ? draft.entries.filter(retryableCancellation).length
    : 0;
  const cancelled = draft.entries.filter(
    (entry) => entry.result?.state === "cancelled",
  ).length;
  const rejected = draft.entries.filter(
    (entry) => entry.result?.state === "rejected",
  ).length;
  return (
    <section className={s.card} data-reservation-batch aria-busy={batch.busy}>
      <h2>{t("batchTitle")}</h2>
      <p>{t("batchNote", { count: CANCELLATION_BATCH_LIMIT })}</p>
      {!batch.canManage && <p>{t("batchReadOnly")}</p>}
      {batch.invalid && <p role="alert">{t("invalidRecovery")}</p>}
      {batch.storageFailed && <p role="alert">{t("storageUnavailable")}</p>}
      {batch.needsFreshQueue && <p role="status">{t("waitFreshRows")}</p>}
      <p role="status">
        {t(draft.submitted ? "batchResults" : "batchSelected", {
          count: draft.entries.length,
          cancelled,
          rejected,
          unresolved,
        })}
      </p>
      {draft.submitted && <p className={s.muted}>{t("batchRetryNote")}</p>}
      <ol className={s.lines}>
        {draft.entries.map((entry) => (
          <li key={entry.row.requestId} className={b.receipt}>
            <strong>{entry.label}</strong>
            <small>
              {t("allocationReference", {
                id: entry.row.allocationId,
                revision: entry.row.expectedRevision,
              })}
            </small>
            {draft.submitted && (
              <>
                <span className={s.badge}>
                  {t(
                    entry.result?.state === "cancelled"
                      ? "rowCancelled"
                      : entry.result?.state === "rejected"
                        ? "rowRejected"
                        : "rowUnresolved",
                  )}
                </span>
                <small>
                  {t("requestReference", { id: entry.row.requestId })}
                </small>
                {entry.result?.state === "cancelled" ? (
                  <p>
                    {t("cancellationReceipt", {
                      revision: entry.result.receipt.revision,
                    })}
                  </p>
                ) : (
                  <p>
                    {entry.result?.state === "rejected"
                      ? t("rowReselect")
                      : t("rowRetry")}
                  </p>
                )}
                {entry.result && entry.result.state !== "cancelled" && (
                  <p>
                    {entry.result.code === "BATCH_PAUSED"
                      ? t("batchPaused")
                      : entry.result.code === "AWAITING_RECEIPT"
                        ? t("awaitingReceipt")
                        : p(reviewError(entry.result.code))}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
      <div className={s.actions}>
        {!draft.submitted && (
          <button
            className={s.primary}
            disabled={!batch.canSelect || !draft.entries.length}
            onClick={() => batch.setPreview(true)}
          >
            {t("previewCancellation")}
          </button>
        )}
        {draft.submitted && unresolved > 0 && (
          <button
            className={s.primary}
            disabled={batch.busy || !batch.canManage || batch.invalid}
            onClick={() => void batch.submit()}
          >
            {t(batch.busy ? "saving" : "retryUnresolved", {
              count: unresolved,
            })}
          </button>
        )}
        {draft.entries.length > 0 &&
          (!draft.submitted || cancelled + rejected > 0) && (
            <button
              className={s.secondary}
              disabled={batch.busy || batch.invalid}
              onClick={batch.clearTerminal}
            >
              {t(draft.submitted ? "acknowledgeResults" : "clearSelection")}
            </button>
          )}
      </div>
      {batch.preview && (
        <ConversationDialog
          title={t("previewCancellation")}
          onClose={() => {
            if (!batch.busy) batch.setPreview(false);
          }}
        >
          <p>{t("batchConfirm", { count: draft.entries.length })}</p>
          <ul className={s.lines}>
            {draft.entries.map((entry) => (
              <li key={entry.row.requestId}>{entry.label}</li>
            ))}
          </ul>
          <p>{t("batchRetryNote")}</p>
          <div className={s.actions}>
            <button
              className={s.secondary}
              disabled={batch.busy}
              onClick={() => batch.setPreview(false)}
            >
              {p("cancel")}
            </button>
            <button
              className={s.primary}
              disabled={batch.busy || !batch.canManage || batch.invalid}
              onClick={() => void batch.submit()}
            >
              {t("confirmBatch")}
            </button>
          </div>
        </ConversationDialog>
      )}
    </section>
  );
}
