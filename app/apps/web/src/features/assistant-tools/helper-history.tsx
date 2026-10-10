"use client";
import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { readHelperHistoryAction } from "./helper-history-actions";
import type { HelperHistoryView } from "./helper-history-model";
import type { AssistantLocale } from "./copy";
import s from "./assistant-tools.module.css";

const outcomes = {
  en: { prepared: "Proposal saved for review", discarded: "Proposal discarded", applied: "Explicitly accepted into the draft", conflict: "Not applied: draft changed" },
  bg: { prepared: "Предложението е запазено за преглед", discarded: "Предложението е отхвърлено", applied: "Изрично прието в черновата", conflict: "Не е приложено: черновата е променена" },
} as const;
export function HelperHistory({ subject, sellerId, locale }: { subject: string; sellerId: string; locale: AssistantLocale }) {
  const bg = locale === "bg", [view, setView] = useState<HelperHistoryView | null>(null),
    [before, setBefore] = useState<string | null>(null), [retry, setRetry] = useState(0),
    [status, setStatus] = useState<"loading" | "ready" | "denied" | "unavailable">("loading");
  useEffect(() => {
    let alive = true;
    startTransition(() => { setStatus("loading"); setView(null); });
    void readHelperHistoryAction({ sellerId, before }).then((result) => {
      if (!alive) return;
      if (result.ok && result.data.subject === subject && result.data.value.sellerId === sellerId) {
        setView(result.data.value); setStatus("ready");
      } else setStatus(!result.ok && ["FORBIDDEN", "NOT_FOUND", "UNAUTHENTICATED"].includes(result.code) ? "denied" : "unavailable");
    }).catch(() => { if (alive) setStatus("unavailable"); });
    return () => { alive = false; };
  }, [subject, sellerId, before, retry]);
  return <section className={s.panel} aria-labelledby="helper-history-heading">
    <h2 id="helper-history-heading">{bg ? "Твоите записани решения" : "Your recorded decisions"}</h2>
    <p className={s.note}>{bg ? "Минимални потвърждения за твоите действия в този акаунт. Приета чернова не означава публикация, промяна на цена или наличност. Изтритият текст на предложение не се възстановява от предположения." : "Minimal receipts for your actions in this account. An accepted draft is not a publication, price or stock change. Deleted proposal text is not reconstructed or guessed."}</p>
    {status === "loading" && <p role="status">{bg ? "Зареждане…" : "Loading…"}</p>}
    {status === "denied" && <p role="alert">{bg ? "Достъпът е променен. Отвори отново разрешения акаунт." : "Access has changed. Reopen an authorized account."}</p>}
    {status === "unavailable" && <div><p role="alert">{bg ? "Историята не може да бъде заредена." : "History could not be loaded."}</p><button className={s.button} onClick={() => setRetry((value) => value + 1)}>{bg ? "Опитай отново" : "Retry"}</button></div>}
    {status === "ready" && view && <>
      {!view.items.length && <p>{bg ? "Все още няма записани решения." : "No recorded decisions yet."}</p>}
      {view.items.map((item) => <article key={item.requestId} className={s.row}>
        <strong>{outcomes[locale][item.outcome]}</strong>
        <p><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" }).format(new Date(item.createdAt))}</time> · #{item.revision}</p>
        {item.draftId && <Link href={`/app/sellers/${sellerId}/listings/${item.draftId}/edit?lang=${locale}`}>{bg ? "Отвори текущата чернова" : "Open current draft"}{item.draftRevision ? ` · #${item.draftRevision}` : ""}</Link>}
      </article>)}
      <nav className={s.actions} aria-label={bg ? "Страници от историята" : "History pages"}>
        {before && <button className={s.button} onClick={() => setBefore(null)}>{bg ? "Последни" : "Latest"}</button>}
        {view.nextBefore && <button className={s.button} onClick={() => setBefore(view.nextBefore)}>{bg ? "По-стари" : "Older"}</button>}
      </nav>
    </>}
  </section>;
}
