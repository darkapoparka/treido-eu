import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { getDatabase } from "../../server/db/database";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "./backend-status.server";
import { BackendUnavailable } from "./workspace";
import { requirePageIdentity, readPrivatePage } from "./page-context.server";
import { readCustomerHistory } from "./customer-history.server";
import { SellerOrders } from "../payments/seller-orders";
import { PaymentBoundary } from "../payments/controls";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";

export async function CustomerHistoryPage({ params, searchParams }: {
  params: Promise<{ sellerId: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  if (!backendConfigured()) return <BackendUnavailable />;
  const { sellerId, id } = await params, query = await searchParams;
  const language = await pageLocale(query.lang), bg = language === "bg";
  const base = `/app/sellers/${sellerId}/customers/${id}`;
  const identity = await requirePageIdentity(`${base}?lang=${language}`);
  const view = await readPrivatePage(() => readCustomerHistory(getDatabase(), identity, sellerId, id, query));
  const exportQuery = new URLSearchParams({ lang: language, actor: view.actorKey });
  if (view.before) exportQuery.set("before", view.before);
  const date = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <main>
    <header className={admin.pageBar}><h1>{view.reference}</h1><Link className={admin.secondary} href={`/app/sellers/${sellerId}/customers?lang=${language}`}>{bg ? "Всички клиенти" : "All customers"}</Link></header>
    <PaymentBoundary actorSubject={identity.subject} language={language}>
      <div className={admin.pageBody}><div className={styles.stack}>
        <section className={editor.panel}>
          <h2>{bg ? "История на клиента" : "Customer history"}</h2>
          <p>{bg ? "Поръчките на този клиент само при този продавач. Данните за получаване и доставката са в съответната поръчка." : "This customer's orders with this seller only. Collection and shipping details are available in the relevant order."}</p>
          <dl className={styles.columns}>
            <div><dt>{bg ? "Записани поръчки" : "Recorded orders"}</dt><dd>{view.orderCount}</dd></div>
            <div><dt>{bg ? "Изцяло възстановени поръчки" : "Fully refunded orders"}</dt><dd>{view.refunded}</dd></div>
            <div><dt>{bg ? "Първа поръчка" : "First order"}</dt><dd>{date(view.firstAt)}</dd></div>
            <div><dt>{bg ? "Последна поръчка" : "Last order"}</dt><dd>{date(view.lastAt)}</dd></div>
          </dl>
          {view.followUp > 0 && <p>{bg ? `Поръчки за финансово проследяване: ${view.followUp}` : `${view.followUp} orders need financial follow-up.`}</p>}
          {view.canExport && <a className={admin.secondary} href={`${base}/export?${exportQuery}`} download>{bg ? "Експортирай тази страница" : "Export this page"}</a>}
        </section>
        <SellerOrders orders={view.orders} sellerId={sellerId} language={language} detail={false} />
        <nav className={styles.actions} aria-label={bg ? "Страници с поръчки" : "Order history pages"}>
          {view.before && <Link className={admin.secondary} href={`${base}?lang=${language}`}>{bg ? "Най-нови поръчки" : "Latest orders"}</Link>}
          {view.nextBefore && <Link className={admin.secondary} href={`${base}?${new URLSearchParams({ lang: language, before: view.nextBefore })}`}>{bg ? "По-стари поръчки" : "Older orders"}</Link>}
        </nav>
      </div></div>
    </PaymentBoundary>
  </main>;
}
