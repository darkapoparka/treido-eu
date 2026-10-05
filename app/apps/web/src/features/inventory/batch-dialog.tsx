"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { changeStockBatchAction } from "./index-actions";
import type { InventoryIndex } from "./index-model";
import { INVENTORY_LIMITS, variantCaption } from "./model";
import type { StockBatchCommand } from "./batch-model";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import d from "../sellers/admin-product-management.module.css";
import s from "./inventory.module.css";
export function StockBatchDialog({
  rows,
  sellerId,
  actorSubject,
  active,
  onClose,
  onSaved,
}: {
  rows: InventoryIndex["items"];
  sellerId: string;
  actorSubject: string;
  active: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("inventory"),
    clerk = useClerk(),
    element = useRef<HTMLDialogElement>(null);
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(rows.map((row) => [row.skuId!, String(row.onHand)])),
  );
  const [reason, setReason] = useState(""),
    [kind, setKind] = useState<StockBatchCommand["reasonKind"]>("adjustment");
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  const life = useRef({ live: true, busy: false }),
    attempt = useRef<{ key: string; command: StockBatchCommand } | null>(null);
  useEffect(() => {
    const current = life.current,
      dialog = element.current,
      opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      overflow = document.body.style.overflow;
    current.live = true;
    document.body.style.overflow = "hidden";
    return () => {
      current.live = false;
      dialog?.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const dialog = element.current;
    if (active) {
      if (dialog && !dialog.open) dialog.showModal();
    } else dialog?.close();
  }, [active]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (life.current.busy || !active || clerk.user?.id !== actorSubject) return;
    const lines = rows.map((row) => ({
      listingId: row.listingId,
      skuId: row.skuId!,
      expectedRevision: row.inventoryRevision!,
      onHand: /^\d+$/.test(quantities[row.skuId!])
        ? Number(quantities[row.skuId!])
        : NaN,
    }));
    if (
      reason.trim().length < 2 ||
      lines.some(
        (line, index) =>
          !Number.isSafeInteger(line.onHand) ||
          line.onHand < rows[index].reserved ||
          line.onHand >
            (rows[index].mode === "unique" ? 1 : INVENTORY_LIMITS.onHand),
      )
    ) {
      setError("INVALID_INPUT");
      return;
    }
    const key = JSON.stringify({ lines, reason, kind });
    if (attempt.current?.key !== key)
      attempt.current = {
        key,
        command: {
          sellerId,
          requestId: crypto.randomUUID(),
          lines,
          reason,
          reasonKind: kind,
        },
      };
    life.current.busy = true;
    setPending(true);
    setError(null);
    try {
      const response = await changeStockBatchAction(attempt.current.command);
      if (!life.current.live || clerk.user?.id !== actorSubject) return;
      if (!response.ok) {
        setError(response.code);
        if (response.code !== "NOT_AVAILABLE") attempt.current = null;
        return;
      }
      attempt.current = null;
      onSaved();
      onClose();
    } catch {
      if (life.current.live) setError("NOT_AVAILABLE");
    } finally {
      life.current.busy = false;
      if (life.current.live) setPending(false);
    }
  }
  return (
    <dialog
      ref={element}
      className={d.dialog}
      aria-label={t("bulkAdjust")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2>{t("bulkAdjust")}</h2>
      <form className={s.form} onSubmit={submit}>
        <p className={f.help}>{t("bulkNote")}</p>
        <fieldset className={s.options} disabled={pending}>
          {rows.map((row) => (
            <label key={row.skuId} className={s.batchRow}>
              <span>
                <strong>{row.title}</strong>
                <small>
                  {variantCaption(row.options) ||
                    row.sellerSku ||
                    t("defaultVariant")}
                </small>
                <small>{t("reservedCount", { count: row.reserved })}</small>
              </span>
              <span className={f.field}>
                {t("onHand")}
                <input
                  aria-label={t("stockFor", {
                    title: row.title,
                    variant:
                      variantCaption(row.options) ||
                      row.sellerSku ||
                      t("defaultVariant"),
                  })}
                  type="number"
                  required
                  min={row.reserved}
                  max={row.mode === "unique" ? 1 : INVENTORY_LIMITS.onHand}
                  step={1}
                  value={quantities[row.skuId!]}
                  onChange={(event) =>
                    setQuantities({
                      ...quantities,
                      [row.skuId!]: event.target.value,
                    })
                  }
                />
              </span>
            </label>
          ))}
          <label className={f.field}>
            {t("reasonKind")}
            <select
              aria-label={t("reasonKind")}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as StockBatchCommand["reasonKind"])
              }
            >
              {(["adjustment", "reported_sale", "restock"] as const).map(
                (value) => (
                  <option key={value} value={value}>
                    {t(value)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className={f.field}>
            {t("reason")}
            <input
              required
              minLength={2}
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </fieldset>
        {error && (
          <p className={s.notice} role="alert">
            {t(
              error === "CONFLICT"
                ? "bulkConflict"
                : error === "INVALID_INPUT"
                  ? "invalid"
                  : error === "FORBIDDEN" || error === "UNAUTHENTICATED"
                    ? "denied"
                    : "unavailable",
            )}
          </p>
        )}
        <footer className={d.dialogActions}>
          <button type="button" className={a.secondary} onClick={onClose}>
            {t("cancel")}
          </button>
          <button className={a.primary} disabled={pending}>
            {t(pending ? "saving" : "save")}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
