import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { getDatabase } from "../../server/db/database";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "./backend-status.server";
import { BackendUnavailable } from "./workspace";
import { requirePageIdentity, readPrivatePage } from "./page-context.server";
import { readSellerContext } from "./persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { readPaidOrders } from "../payments/orders.server";
import { SellerOrders } from "../payments/seller-orders";
import { PaymentBoundary, OrderControls } from "../payments/controls";
import { readOrderAftercare } from "../order-aftercare/queries.server";
import { CaseComposer } from "../order-aftercare/controls";
import { aftercareState } from "../order-aftercare/messages";
import { readOrderOperationalContext } from "./order-operations.server";
import { MerchantShippingForm } from "./merchant-shipping-form";
import { OrderActivity } from "./order-activity";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";

export async function MerchantOrderDetailPage({ params, searchParams }: {
  params: Promise<{ sellerId: string; id: string }>; searchParams: Promise<{ lang?: string }>;
}) {
  await connection();
  if (!backendConfigured()) return <BackendUnavailable />;
  const { sellerId, id } = await params;
  const language = await pageLocale((await searchParams).lang), bg = language === "bg";
  const base = `/app/sellers/${sellerId}`;
  const identity = await requirePageIdentity(`${base}/orders/${id}?lang=${language}`);
  const database = getDatabase();
  const data = await readPrivatePage(async () => ({
    orders: await readPaidOrders(database, identity, sellerId, id),
    seller: await readSellerContext(database, identity, sellerId, "order.read"),
    context: await readOrderOperationalContext(database, identity, sellerId, id),
    aftercare: await readOrderAftercare(database, identity, sellerId, id, language),
  }));
  const order = data.orders[0];
  return <main>
    <header className={admin.pageBar}><h1>{bg ? "Поръчка" : "Order"} #{id.slice(0, 8)}</h1><Link className={admin.secondary} href={`${base}/orders?lang=${language}`}>{bg ? "Всички поръчки" : "All orders"}</Link></header>
    <PaymentBoundary actorSubject={identity.subject} language={language}>
      <div className={admin.pageBody}><div className={styles.stack}>
        <SellerOrders orders={data.orders} sellerId={sellerId} language={language} detail controls={order.handover === "pickup" ? <OrderControls order={order} actorKey={libraryActorKey(identity)} actorSubject={identity.subject} sellerId={sellerId} canFulfil={data.seller.capabilities.includes("order.fulfil")} canRefund={data.seller.capabilities.includes("refund.request")} language={language} /> : undefined} />
        <section className={editor.panel}>
          <h2>{bg ? "Клиент и приети условия" : "Customer and accepted terms"}</h2>
          <Link href={`${base}/customers/${id}?lang=${language}`}>{data.context.reference}</Link>
          <p>{bg ? `Поръчки при този продавач: ${data.context.orderCount}` : `${data.context.orderCount} orders with this seller`}</p>
          <details><summary>{bg ? "Условия при покупката" : "Terms accepted at purchase"}</summary><p>{data.context.buyerTerms}</p></details>
        </section>
        {order.handover === "shipping" && <section className={editor.panel}><h2>{bg ? "Доставка" : "Shipping"}</h2><MerchantShippingForm key={`${identity.subject}/${id}`} view={data.aftercare} legacyRefund={!!order.refundState} /></section>}
        <section className={editor.panel}>
          <h2>{bg ? "Комуникация, връщания и възстановявания" : "Communication, returns and refunds"}</h2>
          <Link className={admin.secondary} href={`${base}/orders/${id}/support?lang=${language}`}>{bg ? "Отвори поддръжката за поръчката" : "Open order support"}</Link>
          {data.aftercare.cases.map((item) => <details key={item.id}><summary>{aftercareState(item.state, language)}</summary>
            {item.events.at(-1) && <p>{item.events.at(-1)!.body}</p>}
            <CaseComposer key={`${item.id}/${item.revision}`} view={data.aftercare} item={item} />
          </details>)}
        </section>
        <OrderActivity orderCreatedAt={order.createdAt} context={data.context} aftercare={data.aftercare} language={language} />
      </div></div>
    </PaymentBoundary>
  </main>;
}
