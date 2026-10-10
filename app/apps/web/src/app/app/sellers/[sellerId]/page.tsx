import { pageLocale } from "@/features/locale/page-locale.server";
import Link from "next/link";
import { backendConfigured } from "@/features/sellers/backend-status.server";
import { AdminHome } from "@/features/sellers/admin-home";
import { requirePageIdentity, readPrivatePage } from "@/features/sellers/page-context.server";
import { readSellerContext } from "@/features/sellers/persistence.server";
import { readAdminProducts } from "@/features/sellers/admin-products.server";
import { readSellerOperations } from "@/features/sellers/operations.server";
import { getDatabase } from "@/server/db/database";
import { readSellerReadiness, readSellerSetup } from "@/features/sellers/setup.server";
import { SetupChecklist, OperationReadiness } from "@/features/sellers/setup-checklist";
import styles from "@/features/sellers/workspace.module.css";

export default async function SellerOverview({ params, searchParams }: {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { sellerId } = await params;
  const { lang } = await searchParams;
  const language = await pageLocale(lang);
  const bg = language === "bg";
  if (!backendConfigured()) return <AdminHome language={language} unavailable />;
  const identity = await requirePageIdentity(`/app/sellers/${sellerId}?lang=${language}`);
  const database = getDatabase();
  const { seller, drafts, setup, readiness, operations } = await readPrivatePage(async () => {
    const seller = await readSellerContext(database, identity, sellerId);
    const drafts = seller.capabilities.includes("listing.read")
      ? (await readAdminProducts(database, identity, sellerId, { status: "draft" })).items.slice(0, 5)
      : null;
    const setup = seller.kind === "business" ? await readSellerSetup(database, identity, sellerId) : null;
    const readiness = await readSellerReadiness(database, identity, sellerId);
    const operations = await readSellerOperations(database, identity, sellerId);
    return { seller, drafts, setup, readiness, operations };
  });
  return <AdminHome seller={seller} language={language} operations={operations}>
    {setup && <SetupChecklist setup={setup} language={language} />}
    {drafts !== null && <>
      <h2>{bg ? "Последни чернови" : "Recent drafts"}</h2>
      {drafts.length ? drafts.map((draft) => <div key={draft.id} className={styles.row}>
        <div><strong>{draft.title || (bg ? "Чернова без заглавие" : "Untitled draft")}</strong><small>{bg ? "Лична чернова" : "Private draft"} · {draft.priceMinor === null ? bg ? "Без цена" : "No price" : new Intl.NumberFormat(language, { style: "currency", currency: "EUR" }).format(draft.priceMinor / 100)}</small></div>
        <Link className={styles.link} href={`/app/sellers/${sellerId}/listings/${draft.id}/${seller.capabilities.includes("listing.write") ? "edit" : "review"}?lang=${language}`}>{bg ? "Отвори" : "Open"}</Link>
      </div>) : <p>{bg ? "Все още няма чернови." : "No drafts yet."}</p>}
    </>}
    <OperationReadiness readiness={readiness} language={language} />
  </AdminHome>;
}
