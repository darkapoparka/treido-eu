import Link from "next/link";
import { SellerOrders } from "./seller-orders";
import { orderIndexHref, orderQueues, type SellerOrderIndex } from "./order-index-model";
import s from "../sellers/merchant-data.module.css";

const labels = {
  en: { all: "All recorded orders", fulfilment: "To fulfil", financial: "Financial follow-up", refunded: "Fully refunded" },
  bg: { all: "Всички записани поръчки", fulfilment: "За изпълнение", financial: "Финансово уточняване", refunded: "Напълно възстановени" },
} as const;
export function SellerOrderIndexScreen({ view, language }: { view: SellerOrderIndex; language: "bg" | "en" }) {
  const bg = language === "bg", base = `/app/sellers/${view.sellerId}/orders`;
  const exportUrl = new URL(orderIndexHref(view.sellerId, language, view.query, { before: view.query.before }), "https://treido.invalid");
  exportUrl.searchParams.set("actor", view.actorKey);
  return <div className={s.page}>
    <p className={s.intro}>{bg ? "Текущи финансови и оперативни записи за този продавач. Приетата сума не е нетен приход; статусът на плащане не е доказателство за доставка." : "Current financial and operational records for this seller. The accepted amount is not net revenue; payment status is not delivery evidence."}</p>
    {view.query.customerOrder && <p className={s.notice}>{bg ? "Показват се поръчките на избрания клиент в този акаунт." : "Showing the selected customer's orders within this seller account."} <Link href={orderIndexHref(view.sellerId, language, view.query, { customerOrder: null })}>{bg ? "Всички клиенти" : "All customers"}</Link></p>}
    <form action={base} className={s.toolbar}>
      <input type="hidden" name="lang" value={language} />
      {view.query.customerOrder && <input type="hidden" name="customerOrder" value={view.query.customerOrder} />}
      <label className={s.field}>{bg ? "Продукт или референция на поръчката" : "Product or order reference"}<input name="q" type="search" maxLength={160} defaultValue={view.query.q} /></label>
      <label className={s.field}>{bg ? "Оперативен изглед" : "Operational view"}<select name="queue" defaultValue={view.query.queue}>{orderQueues.map((queue) => <option value={queue} key={queue}>{labels[language][queue]}</option>)}</select></label>
      <div className={s.actions}><button>{bg ? "Приложи" : "Apply"}</button><Link href={`${base}?lang=${language}`}>{bg ? "Изчисти" : "Clear"}</Link></div>
    </form>
    <div className={s.toolbar}><div className={s.actions}>
      <Link href={`/app/sellers/${view.sellerId}/customers?lang=${language}`} prefetch={false}>{bg ? "Клиенти" : "Customers"}</Link>
      {view.canExport && <a href={`${base}/export?${exportUrl.searchParams}`}>{bg ? "Експортирай текущата страница" : "Export this page"}</a>}
    </div></div>
    {view.orders.length ? <SellerOrders orders={view.orders} sellerId={view.sellerId} language={language} detail={false} /> : <p role="status">{bg ? "Няма поръчки, отговарящи на този изглед. Промени филтрите или отвори последните записи." : "No orders match this view. Change the filters or open the latest records."}</p>}
    <div className={s.meta}>
      <p>{bg ? "Проверено" : "Checked"}: <time dateTime={view.observedAt}>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" }).format(new Date(view.observedAt))}</time></p>
      <nav className={s.actions} aria-label={bg ? "Страници с поръчки" : "Order pages"}>
        {view.query.before && <Link href={orderIndexHref(view.sellerId, language, view.query)} prefetch={false}>{bg ? "Последни" : "Latest"}</Link>}
        {view.nextBefore && <Link href={orderIndexHref(view.sellerId, language, view.query, { before: view.nextBefore })} prefetch={false}>{bg ? "По-стари" : "Older"}</Link>}
      </nav>
    </div>
    <p className={s.note}>{bg ? "Проверявай приетите права и текущите разрешени действия в конкретната поръчка. Изчакващи възстановявания и неуточнени суми не се представят като приключени." : "Review accepted rights and currently permitted actions inside each order. Pending refunds and uncertain money are never presented as completed."}</p>
  </div>;
}
