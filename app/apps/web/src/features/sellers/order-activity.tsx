import type { AftercareView } from "../order-aftercare/view";
import type { readOrderOperationalContext } from "./order-operations.server";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";

export function OrderActivity({ orderCreatedAt, context, aftercare, language }: {
  orderCreatedAt: string; context: Awaited<ReturnType<typeof readOrderOperationalContext>>; aftercare: AftercareView; language: "bg" | "en";
}) {
  const bg = language === "bg";
  const entries = [{ id: "created", at: orderCreatedAt, label: bg ? "Поръчката е записана" : "Order recorded", detail: "" },
    ...context.events.map((event) => ({ id: `pickup:${event.id}`, at: event.createdAt, detail: "", label: event.kind === "ready" ? (bg ? "Продавачът отбеляза готовност за получаване" : "Seller marked ready for collection") : event.kind === "collected" ? (bg ? "Продавачът записа предаването" : "Seller recorded collection") : (bg ? "Заявено е възстановяване" : "Refund requested") })),
    ...aftercare.fulfilment.events.map((event) => ({ id: `shipping:${event.id}`, at: event.createdAt, detail: event.description, label: event.kind === "buyer_confirmed_delivery" ? (bg ? "Купувачът потвърди получаването" : "Buyer confirmed receipt") : event.kind === "seller_reported_dispatched" ? (bg ? "Продавачът записа изпращане" : "Seller recorded dispatch") : (bg ? "Промяна в изпълнението" : "Fulfilment update") })),
    ...aftercare.cases.flatMap((item) => item.events.map((event) => ({ id: `case:${event.id}`, at: event.createdAt, detail: event.body, label: event.side === "buyer" ? (bg ? "Съобщение от купувача по случай" : "Buyer case update") : event.side === "merchant" ? (bg ? "Отговор на продавача по случай" : "Seller case update") : (bg ? "Преглед от поддръжката" : "Support review") }))),
    ...aftercare.refunds.map((refund) => ({ id: `refund:${refund.id}`, at: refund.createdAt, detail: refund.reason, label: bg ? "Подготвена е заявка за възстановяване" : "Refund request prepared" })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.id.localeCompare(a.id));
  const more = entries.length > 50 || context.moreEvents || aftercare.moreCases || aftercare.moreRefunds || aftercare.cases.some((item) => item.moreEvents);
  return <section className={editor.panel} aria-labelledby="order-activity-heading">
    <h2 id="order-activity-heading">{bg ? "Активност" : "Activity"}</h2>
    <ol className={styles.stack}>{entries.slice(0, 50).map((entry) => <li key={entry.id}><strong>{entry.label}</strong>{entry.detail && <p>{entry.detail}</p>}<time dateTime={entry.at}>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.at))}</time></li>)}</ol>
    {more && <p>{bg ? "Показана е последната активност. Отделните случаи и финансовите резултати са в поддръжката за поръчката." : "Recent activity is shown. Individual cases and financial outcomes are available in order support."}</p>}
  </section>;
}
