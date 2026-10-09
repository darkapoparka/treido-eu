"use client";
import { importMessageKey } from "./copy";
import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import type { ImportRowView } from "./model";
import { CSV_COLUMNS, type CsvRow } from "./csv";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import s from "./import.module.css";
const labels = {
  external_id: "externalField",
  title: "titleField",
  description: "descriptionField",
  category_id: "categoryField",
  condition: "conditionField",
  price: "priceField",
  currency: "currencyField",
  locality: "localityField",
  inventory_mode: "modeField",
  quantity: "quantityField",
  sku: "skuField",
  attributes_json: "attributesField",
  options_json: "optionsField",
} as const;
export function ImportDialog({
  row,
  active,
  pending,
  error,
  onChange,
  onSave,
  onCancel,
  onClose,
}: {
  row?: ImportRowView;
  active: boolean;
  pending: boolean;
  error: string | null;
  onChange: (raw: CsvRow) => void;
  onSave: (raw: CsvRow) => Promise<boolean>;
  onCancel: () => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("catalogueImport"),
    ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  const raw = row?.raw ?? {};
  useEffect(() => {
    const element = ref.current,
      opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (active) {
      if (ref.current && !ref.current.open) ref.current.showModal();
    } else ref.current?.close();
  }, [active]);
  return (
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <h2 id={titleId}>
        {row ? t("editRow", { number: row.number }) : t("cancelQuestion")}
      </h2>
      <p className={f.help}>{t(row ? "rowNote" : "cancelNote")}</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          if (await (row ? onSave(raw) : onCancel())) onClose();
        }}
      >
        {row && (
          <fieldset className={s.fields} disabled={pending}>
            {CSV_COLUMNS.map((key) => (
              <label
                key={key}
                className={
                  ["description", "attributes_json", "options_json"].includes(
                    key,
                  )
                    ? s.wide
                    : undefined
                }
              >
                {t(labels[key])}
                <small>{key}</small>
                {["description", "attributes_json", "options_json"].includes(
                  key,
                ) ? (
                  <textarea
                    name={key}
                    value={raw[key] ?? ""}
                    maxLength={key === "description" ? 6000 : 24000}
                    onChange={(event) =>
                      onChange({ ...raw, [key]: event.target.value })
                    }
                  />
                ) : (
                  <input
                    name={key}
                    value={raw[key] ?? ""}
                    maxLength={
                      key === "title" ? 160 : key === "external_id" ? 128 : 200
                    }
                    onChange={(event) =>
                      onChange({ ...raw, [key]: event.target.value })
                    }
                  />
                )}
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <p className={s.error} role="alert">
            {t(importMessageKey(error))}
          </p>
        )}
        <div className={s.footer}>
          <button
            type="button"
            className={a.secondary}
            disabled={pending}
            onClick={onClose}
          >
            {t(row ? "close" : "keep")}
          </button>
          <button className={a.primary} disabled={pending}>
            {t(row ? "save" : "confirmCancel")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
