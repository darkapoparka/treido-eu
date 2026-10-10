import Link from "next/link";
import type { SellerCustomersView } from "./customers-model";
import { orderIndexHref } from "../payments/order-index-model";
import s from "./merchant-data.module.css";

export function SellerCustomers({ view, language }: { view: SellerCustomersView; language: "bg" | "en" }) {
  const bg = language === "bg", base = `/app/sellers/${view.sellerId}/customers`;
  const date = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "Europe/Sofia" }).format(new Date(value));
  const params = new URLSearchParams({ lang: language });
  if (view.query.before) params.set("before", view.query.before);
  const exportParams = new URLSearchParams(params); exportParams.set("actor", view.actorKey);
  return <div className={s.page}>
    <p className={s.intro}>{bg ? "Купувачи с действително записани поръчки за този продавач. Референциите са отделни за всеки продавач; това не е списък с контакти или разрешение за маркетинг." : "Purchasers with recorded orders for this seller. References are seller-specific; this is not a contact directory or permission for marketing."}</p>
    <div className={s.toolbar}><div className={s.actions}>
      <Link href={`${base}?lang=${language}`} prefetch={false}>{bg ? "Обнови" : "Refresh"}</Link>
      {view.canExport && <a href={`${base}/export?${exportParams}`}>{bg ? "Експортирай текущата страница" : "Export this page"}</a>}
    </div></div>
    {view.customers.length ? <div className={s.tablePanel}><div className={s.tableScroll} tabIndex={0} role="region" aria-label={bg ? "Таблица с клиенти" : "Customer table"}><table className={s.table}>
      <thead><tr><th>{bg ? "Референция" : "Reference"}</th><th>{bg ? "Поръчки" : "Orders"}</th><th>{bg ? "Възстановени" : "Refunded"}</th><th>{bg ? "За финансово уточняване" : "Financial follow-up"}</th><th>{bg ? "Последна поръчка" : "Latest order"}</th></tr></thead>
      <tbody>{view.customers.map((customer) => <tr key={customer.reference}>
        <td className={s.reference}><Link href={orderIndexHref(view.sellerId, language, { q: "", queue: "all", before: null, customerOrder: customer.lastOrderId })} prefetch={false}>{customer.reference}</Link></td>
        <td>{new Intl.NumberFormat(language).format(customer.orderCount)}</td>
        <td>{new Intl.NumberFormat(language).format(customer.refundedOrders)}</td>
        <td>{new Intl.NumberFormat(language).format(customer.financialFollowUp)}</td>
        <td><Link href={`/app/sellers/${view.sellerId}/orders/${customer.lastOrderId}?lang=${language}`} prefetch={false}><time dateTime={customer.lastOrderAt}>{date(customer.lastOrderAt)}</time></Link></td>
      </tr>)}</tbody>
    </table></div></div> : <p role="status">{bg ? "Все още няма купувачи със записани поръчки в тази страница." : "No purchasers with recorded orders on this page."}</p>}
    <div className={s.meta}>
      <p>{bg ? "Проверено" : "Checked"}: <time dateTime={view.observedAt}>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" }).format(new Date(view.observedAt))}</time></p>
      <nav className={s.actions} aria-label={bg ? "Страници с клиенти" : "Customer pages"}>
        {view.query.before && <Link href={`${base}?lang=${language}`} prefetch={false}>{bg ? "Последни" : "Latest"}</Link>}
        {view.nextBefore && <Link href={`${base}?lang=${language}&before=${view.nextBefore}`} prefetch={false}>{bg ? "По-стари" : "Older"}</Link>}
      </nav>
    </div>
    <p className={s.note}>{bg ? "Броят включва историята на възстановявания и спорове, а не брой успешно доставени поръчки. Данни за получател се показват само в разрешения контекст на изпълнение на конкретна поръчка." : "Counts include refunded and disputed history, not a count of successfully delivered orders. Recipient details remain confined to the authorized fulfilment context of an individual order."}</p>
  </div>;
}
