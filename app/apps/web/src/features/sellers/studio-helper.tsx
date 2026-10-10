"use client";
import { useEffect, useId, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { HelperWorkspace, type HelperDialogProps } from "../assistant-tools/helper-workspace";
import { useAssistantLocale } from "../assistant-tools/common-ui";
import s from "./studio-helper.module.css";

/** Native Studio dialog. Opening, dismissal and focus restoration are owned by
 * the browser; the financial/catalog command still requires explicit acceptance. */
export function StudioHelperDialog({ open, title, onClose, children }: HelperDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null), headingId = useId(), locale = useAssistantLocale();
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    else if (!open && element?.open) element.close();
  }, [open]);
  return <dialog ref={dialog} className={s.dialog} aria-labelledby={headingId} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <header className={s.dialogHeader}><h2 id={headingId}>{title}</h2><button type="button" onClick={onClose} aria-label={locale === "bg" ? "Затвори" : "Close"}>×</button></header>
    {open && children}
  </dialog>;
}
export function StudioHelper({ actorSubject, sellerId, initialDraft = "" }: { actorSubject: string; sellerId: string; initialDraft?: string }) {
  const { isLoaded, userId } = useAuth(), locale = useAssistantLocale(), bg = locale === "bg";
  if (!isLoaded) return <p role="status">{bg ? "Проверка на достъпа…" : "Checking access…"}</p>;
  if (userId !== actorSubject) return <p role="alert">{bg ? "Достъпът е променен. Влез отново." : "Access has changed. Sign in again."}</p>;
  return <div className={s.workspace} data-studio-helper="">
    <p className={s.intro}>{bg ? "Подготви описание от фактите в собствената си чернова, провери и поправи предложението и го приеми изрично. Този режим не използва платен модел и не публикува вместо теб." : "Prepare a description from facts in your own draft, review and correct the proposal, then explicitly accept it. This mode does not use a paid model or publish on your behalf."}</p>
    <HelperWorkspace key={`${actorSubject}:${sellerId}`} subject={actorSubject} sellerId={sellerId} initialDraft={initialDraft} Dialog={StudioHelperDialog} />
  </div>;
}
