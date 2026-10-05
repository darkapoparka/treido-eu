"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { parseEuroPrice } from "../selling/draft-model";
import {
  INVENTORY_LIMITS,
  type InventoryOperation,
  type InventorySku,
  type InventoryView,
} from "./model";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import d from "../sellers/admin-product-management.module.css";
import s from "./inventory.module.css";
export type InventoryDialogKind = "setup" | "variant" | "stock" | "archive";
export function InventoryDialog({
  kind,
  sku,
  inventory,
  pending,
  error,
  onSubmit,
  onClose,
  active = true,
}: {
  active?: boolean;
  kind: InventoryDialogKind;
  sku?: InventorySku;
  inventory: InventoryView;
  pending: boolean;
  error: string | null;
  onSubmit: (
    operation: InventoryOperation,
    expectedRevision: number,
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("inventory"),
    dialog = useRef<HTMLDialogElement>(null),
    live = useRef(true);
  const [mode, setMode] = useState<"unique" | "stocked">(
    inventory.mode ?? "unique",
  );
  const [sellerSku, setSellerSku] = useState(sku?.sellerSku ?? "");
  const [quantity, setQuantity] = useState(String(sku?.onHand ?? 1));
  const [price, setPrice] = useState(
    sku?.priceMinor == null ? "" : (sku.priceMinor / 100).toFixed(2),
  );
  const [reason, setReason] = useState("");
  const [reasonKind, setReasonKind] = useState<
    "adjustment" | "reported_sale" | "restock"
  >("adjustment");
  const [options, setOptions] = useState(() =>
    Object.entries(
      sku?.options ??
        Object.fromEntries(
          Object.keys(inventory.skus[0]?.options ?? {}).map((key) => [key, ""]),
        ),
    ),
  );
  const [invalid, setInvalid] = useState(false);
  const expectedRevision = useRef(inventory.revision);
  const title = t(
    kind === "setup"
      ? "setup"
      : kind === "stock"
        ? "adjust"
        : kind === "archive"
          ? "archiveVariant"
          : sku
            ? "editVariant"
            : "addVariant",
  );
  useEffect(() => {
    live.current = true;
    const element = dialog.current,
      opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      live.current = false;
      element?.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (active) {
      if (element && !element.open) element.showModal();
    } else element?.close();
  }, [active]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const amount = parseEuroPrice(price),
      count = /^\d+$/.test(quantity) ? Number(quantity) : NaN;
    if (
      amount === "invalid" ||
      ((kind === "setup" || kind === "stock" || (kind === "variant" && !sku)) &&
        (!Number.isSafeInteger(count) ||
          count < 0 ||
          count > (mode === "unique" ? 1 : INVENTORY_LIMITS.onHand))) ||
      (kind === "variant" &&
        (options.some(([key, value]) => !key.trim() || !value.trim()) ||
          new Set(options.map(([key]) => key.trim().toLowerCase())).size !==
            options.length))
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const operation: InventoryOperation =
      kind === "setup"
        ? { kind, mode, onHand: count, sellerSku }
        : kind === "stock"
          ? { kind, skuId: sku!.id, onHand: count, reason, reasonKind }
          : kind === "archive"
            ? { kind, skuId: sku!.id }
            : {
                kind,
                skuId: sku?.id ?? null,
                sellerSku,
                options: Object.fromEntries(options),
                priceMinor: amount,
                ...(!sku ? { onHand: count } : {}),
              };
    const ok = await onSubmit(operation, expectedRevision.current);
    if (ok && live.current) onClose();
  }
  return (
    <dialog
      ref={dialog}
      className={d.dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <h2>{title}</h2>
      <form className={s.form} onSubmit={submit}>
        <fieldset className={s.options} disabled={pending}>
          {kind === "setup" && (
            <>
              <p className={f.help}>{t("setupNote")}</p>
              <label className={f.field}>
                {t("mode")}
                <select
                  aria-label={t("mode")}
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as "unique" | "stocked")
                  }
                >
                  <option value="unique">{t("unique")}</option>
                  {inventory.kind === "business" && (
                    <option value="stocked">{t("stocked")}</option>
                  )}
                </select>
              </label>
              <p className={f.help}>{t("modeNote")}</p>
            </>
          )}
          {(kind === "setup" || kind === "variant") && (
            <label className={f.field}>
              {t("sku")}
              <input
                value={sellerSku}
                maxLength={64}
                onChange={(event) => setSellerSku(event.target.value)}
              />
            </label>
          )}
          {kind === "variant" && (
            <>
              <label className={f.field}>
                {t("price")}
                <input
                  value={price}
                  inputMode="decimal"
                  maxLength={12}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </label>
              <p className={f.help}>{t("basePrice")}</p>
              {inventory.mode === "stocked" && (
                <fieldset className={s.options}>
                  <legend>{t("options")}</legend>
                  {options.map(([key, value], index) => (
                    <div key={index} className={s.option}>
                      <label className={f.field}>
                        {t("optionName")}
                        <input
                          value={key}
                          maxLength={40}
                          onChange={(event) =>
                            setOptions(
                              options.map((row, i) =>
                                i === index
                                  ? [event.target.value, row[1]]
                                  : row,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className={f.field}>
                        {t("optionValue")}
                        <input
                          value={value}
                          maxLength={60}
                          onChange={(event) =>
                            setOptions(
                              options.map((row, i) =>
                                i === index
                                  ? [row[0], event.target.value]
                                  : row,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className={a.secondary}
                        onClick={() =>
                          setOptions(options.filter((_, i) => i !== index))
                        }
                      >
                        {t("removeOption")}
                      </button>
                    </div>
                  ))}
                  {options.length < INVENTORY_LIMITS.dimensions && (
                    <button
                      type="button"
                      className={a.secondary}
                      onClick={() => setOptions([...options, ["", ""]])}
                    >
                      {t("addOption")}
                    </button>
                  )}
                  <p className={f.help}>{t("optionsNote")}</p>
                </fieldset>
              )}
            </>
          )}
          {(kind === "setup" ||
            kind === "stock" ||
            (kind === "variant" && !sku)) && (
            <label className={f.field}>
              {t("onHand")}
              <input
                type="number"
                min={kind === "stock" ? sku?.reserved : 0}
                max={mode === "unique" ? 1 : INVENTORY_LIMITS.onHand}
                step={1}
                required
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
          )}
          {kind === "stock" && (
            <>
              <label className={f.field}>
                {t("reasonKind")}
                <select
                  aria-label={t("reasonKind")}
                  value={reasonKind}
                  onChange={(event) =>
                    setReasonKind(event.target.value as typeof reasonKind)
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
              <p className={f.help}>{t("reportedNote")}</p>
            </>
          )}
          {kind === "archive" && <p>{t("archiveNote")}</p>}
        </fieldset>
        {(invalid || error) && (
          <p className={s.notice} role="alert">
            {t(
              invalid || error === "INVALID_INPUT"
                ? "invalid"
                : error === "CONFLICT"
                  ? "conflict"
                  : error === "QUOTA_EXCEEDED"
                    ? "limit"
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
            {t(pending ? "saving" : kind === "archive" ? "confirm" : "save")}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
