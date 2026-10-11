"use client";
import { importMessageKey } from "./copy";
import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import type { ImportRowView } from "./model";
import type { CsvRow } from "./csv";
import { ImportRowFields } from "./row-fields";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import s from "./import.module.css";
export function ImportDialog({ row, active, pending, error, onChange, onSave, onCancel, onClose }: {
  row?: ImportRowView; active: boolean; pending: boolean; error: string | null;
  onChange: (raw: CsvRow) => void; onSave: (raw: CsvRow) => Promise<boolean>;
  onCancel: () => Promise<boolean>; onClose: () => void;
}) {
  const t = useTranslations("catalogueImport"), ref = useRef<HTMLDialogElement>(null), titleId = useId();
  const raw = row?.raw ?? {};
  useEffect(() => {
    const element = ref.current, opener = document.activeElement instanceof HTMLElement ? document.activeElement : null,
      previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previous; if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (active) { if (ref.current && !ref.current.open) ref.current.showModal(); } else ref.current?.close(); }, [active]);
  return <dialog ref={ref} className={s.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}>
    <h2 id={titleId}>{row ? t("editRow", { number: row.number }) : t("cancelQuestion")}</h2>
    <p className={f.help}>{t(row ? "rowNote" : "cancelNote")}</p>
    <form onSubmit={async (event) => { event.preventDefault(); if (pending) return; if (await (row ? onSave(raw) : onCancel())) onClose(); }}>
      {row && <fieldset className={s.fields} disabled={pending}><ImportRowFields row={row} onChange={onChange} /></fieldset>}
      {error && <p className={s.error} role="alert">{t(importMessageKey(error))}</p>}
      <div className={s.footer}>
        <button type="button" className={a.secondary} disabled={pending} onClick={onClose}>{t(row ? "close" : "keep")}</button>
        <button className={a.primary} disabled={pending}>{t(row ? "save" : "confirmCancel")}</button>
      </div>
    </form>
  </dialog>;
}
