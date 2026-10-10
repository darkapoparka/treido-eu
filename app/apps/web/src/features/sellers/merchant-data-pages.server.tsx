import "server-only";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDatabase } from "../../server/db/database";
import { pageLocale } from "../locale/page-locale.server";
import { PaymentBoundary } from "../payments/controls";
import { readSellerOrderIndex } from "../payments/order-index.server";
import { SellerOrderIndexScreen } from "../payments/order-index";
import { readSellerCustomers } from "./customers.server";
import { SellerCustomers } from "./customers";
import { backendConfigured } from "./backend-status.server";
import { requirePageIdentity, readPrivatePage } from "./page-context.server";
import a from "./admin.module.css";

type Props = {
  params: Promise<{ sellerId?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function merchantDataPage(props: Props, kind: "orders" | "customers") {
  await connection();
  const { sellerId } = await props.params;
  if (!sellerId) notFound();
  const raw = await props.searchParams, language = await pageLocale(raw.lang), bg = language === "bg";
  const title = kind === "orders" ? bg ? "Поръчки" : "Orders" : bg ? "Клиенти" : "Customers";
  const shell = (children: React.ReactNode) => <main><header className={a.pageBar}><h1>{title}</h1></header><div className={a.pageBody}>{children}</div></main>;
  if (!backendConfigured()) return shell(<p role="status">{bg ? "Данните временно не са достъпни. Опитай отново; записите не се променят." : "Data is temporarily unavailable. Try again; records are unchanged."}</p>);
  const identity = await requirePageIdentity(`/app/sellers/${sellerId}/${kind}?lang=${language}`);
  const screen = kind === "orders"
    ? <SellerOrderIndexScreen view={await readPrivatePage(() => readSellerOrderIndex(getDatabase(), identity, sellerId, raw))} language={language} />
    : <SellerCustomers view={await readPrivatePage(() => readSellerCustomers(getDatabase(), identity, sellerId, raw))} language={language} />;
  return shell(<PaymentBoundary actorSubject={identity.subject} language={language}>{screen}</PaymentBoundary>);
}
export async function SellerOrderIndexPage(props: Props) { return merchantDataPage(props, "orders"); }
export async function SellerCustomersPage(props: Props) { return merchantDataPage(props, "customers"); }
