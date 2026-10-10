import type { OrderCommand, OrderView } from "./model";
import { paymentText, type PaymentLanguage } from "./messages";
import e from "../sellers/admin-editor.module.css";
import p from "../sellers/preview/preview.module.css";
import s from "./seller-orders.module.css";

export type SellerOrderActionsProps = {
  order: OrderView;
  canFulfil: boolean;
  canRefund: boolean;
  language: PaymentLanguage;
  pending: boolean;
  blocked: boolean;
  recovery: OrderCommand | null;
  reason: string;
  confirmed: boolean;
  error: string | null;
  onReason: (value: string) => void;
  onConfirmed: (value: boolean) => void;
  onSubmit: (action: OrderCommand["action"]) => void;
  onRefresh: () => void;
};

export function SellerOrderActions({
  order,
  canFulfil,
  canRefund,
  language,
  pending,
  blocked,
  recovery,
  reason,
  confirmed,
  error,
  onReason,
  onConfirmed,
  onSubmit,
  onRefresh,
}: SellerOrderActionsProps) {
  const t = paymentText(language);
  const paid =
    order.paymentState === "paid" && order.settlementState === "transferred";
  const refundAvailable =
    canRefund &&
    !order.refundState &&
    ["paid", "reconciliation", "disputed"].includes(order.paymentState);
  return (
    <div className={p.stack} aria-busy={pending}>
      {canFulfil &&
        paid &&
        order.fulfilmentState === "pending" &&
        !recovery && (
          <div className={p.actions}>
            <button
              type="button"
              className={`${p.button} ${p.primary} ${s.touchAction}`}
              disabled={pending || blocked}
              onClick={() => onSubmit("ready")}
            >
              {t.readyAction}
            </button>
          </div>
        )}
      {refundAvailable && !recovery && (
        <fieldset className={s.refundForm} disabled={pending || blocked}>
          <label className={e.field}>
            {t.reason}
            <textarea
              className={s.reason}
              maxLength={500}
              value={reason}
              onChange={(event) => onReason(event.target.value)}
            />
          </label>
          <label className={`${p.check} ${s.confirm}`}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => onConfirmed(event.target.checked)}
            />
            <span>{t.confirmRefund}</span>
          </label>
          <div className={p.actions}>
            <button
              type="button"
              className={`${p.button} ${s.touchAction}`}
              disabled={!confirmed || !reason.trim()}
              onClick={() => onSubmit("refund")}
            >
              {t.refundAction}
            </button>
          </div>
          <p className={p.muted}>{t.refundNotice}</p>
        </fieldset>
      )}
      {recovery && (
        <section className={p.stack}>
          <p role="status">{t.reconciling}</p>
          {recovery.action === "refund" && (
            <>
              <p className={s.savedReason}>
                {t.reason}: {recovery.reason}
              </p>
              <label className={`${p.check} ${s.confirm}`}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={pending || blocked}
                  onChange={(event) => onConfirmed(event.target.checked)}
                />
                <span>{t.confirmRefund}</span>
              </label>
              <p className={p.muted}>{t.refundNotice}</p>
            </>
          )}
          <div className={p.actions}>
            <button
              type="button"
              className={`${p.button} ${s.touchAction}`}
              disabled={
                pending ||
                blocked ||
                (recovery.action === "refund" && !confirmed)
              }
              onClick={() => onSubmit(recovery.action)}
            >
              {t.retryOriginal}
            </button>
          </div>
        </section>
      )}
      {!recovery &&
        (order.refundState ||
          order.paymentState === "refund_pending" ||
          order.paymentState === "refunded") && (
          <p className={p.muted} role="status">
            {t.refundNotice}
          </p>
        )}
      {pending && (
        <p role="status">
          {language === "bg"
            ? "Проверка на заявката…"
            : "Checking the request…"}
        </p>
      )}
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      <div className={p.actions}>
        <button
          type="button"
          className={`${p.button} ${s.touchAction}`}
          disabled={pending}
          onClick={onRefresh}
        >
          {t.refresh}
        </button>
      </div>
    </div>
  );
}
