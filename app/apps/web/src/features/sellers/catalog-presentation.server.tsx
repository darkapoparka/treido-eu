import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDatabase } from "../../server/db/database";
import { pageLocale } from "../locale/page-locale.server";
import { requirePageIdentity, readPrivatePage } from "./page-context.server";
import { readPrivateCatalogPreview, readPublicCatalogCollection } from "./catalog-public.server";
import { ProductCard } from "../discovery/product-card";
import { ShopSurface } from "../discovery/hydration-boundary";
import { validId } from "../selling/draft-model";
import admin from "./admin.module.css";
import styles from "./catalog-presentation.module.css";

type Search = Record<string, string | string[] | undefined>;
export function CatalogNavigation({ sellerId, language }: { sellerId: string; language: "bg" | "en" }) {
  const bg = language === "bg", base = `/app/sellers/${sellerId}`;
  return <nav className={styles.navigation} aria-label={bg ? "Организация на продуктите" : "Product organization"}>
    <Link className={admin.secondary} href={`${base}/collections?lang=${language}`}>{bg ? "Колекции" : "Collections"}</Link>
    <Link className={admin.secondary} href={`${base}/catalog?lang=${language}`}>{bg ? "Етикети и групова редакция" : "Tags and bulk editing"}</Link>
  </nav>;
}
async function presentation(sellerId: string, collectionId: string, query: Search, preview: boolean) {
  await connection();
  const after = typeof query.after === "string" ? query.after : undefined;
  if (!validId(sellerId) || !validId(collectionId) || (query.after !== undefined && (!after || !validId(after)))) notFound();
  const language = await pageLocale(query.lang), bg = language === "bg";
  const base = preview ? `/app/sellers/${sellerId}/collections/${collectionId}/preview` : `/stores/${sellerId}/collections/${collectionId}`;
  const params = new URLSearchParams({ lang: language });
  if (after) params.set("after", after);
  const database = getDatabase();
  const identity = preview ? await requirePageIdentity(`${base}?${params}`) : null;
  const view = identity
    ? await readPrivatePage(() => readPrivateCatalogPreview(database, identity, sellerId, collectionId, after))
    : await readPublicCatalogCollection(database, sellerId, collectionId, after);
  if (!view) notFound();
  const next = new URLSearchParams({ lang: language });
  if (view.nextAfter) next.set("after", view.nextAfter);
  return <ShopSurface className={styles.page}>
    <header className={styles.header}>
      <Link href={preview ? `/app/sellers/${sellerId}/collections/${collectionId}?lang=${language}` : `/stores/${sellerId}?lang=${language}`}>
        {preview ? (bg ? "Към редакцията на колекцията" : "Back to collection editor") : view.collection.sellerName}
      </Link>
      <h1>{view.collection.title}</h1>
      {view.collection.description && <p className={styles.description}>{view.collection.description}</p>}
      {preview && <p role="status">{bg ? "Преглед на запазената колекция. Тук се показват само продуктите, които в момента могат да бъдат видени от купувачите." : "Saved collection preview. Only products currently eligible for buyers are shown here."}</p>}
      {preview && (view.collection.publicAvailable
        ? <Link href={`/stores/${sellerId}/collections/${collectionId}?lang=${language}`} target="_blank" rel="noreferrer">{bg ? "Отвори публичната колекция" : "Open public collection"}</Link>
        : <p>{bg ? "Публичната страница ще е достъпна, когато колекцията е видима и магазинът има достъпен публикуван продукт." : "The public page becomes available when the collection is visible and the store has an eligible published product."}</p>)}
    </header>
    {view.items.length ? <div className={styles.grid}>{view.items.map((product) => <ProductCard key={product.id} product={product} publicMedia showSave={false} showRating={false} />)}</div>
      : <p role="status">{bg ? "В тази колекция още няма достъпни публикувани продукти." : "There are no eligible published products in this collection yet."}</p>}
    <nav className={styles.actions} aria-label={bg ? "Страници на колекцията" : "Collection pages"}>
      {after && <Link href={`${base}?lang=${language}`}>{bg ? "Първа страница" : "First page"}</Link>}
      {view.nextAfter && <Link href={`${base}?${next}`}>{bg ? "Още продукти" : "More products"}</Link>}
    </nav>
  </ShopSurface>;
}
export async function PublicCatalogCollectionPage({ params, searchParams }: { params: Promise<{ id: string; slug: string }>; searchParams: Promise<Search> }) {
  const { id, slug } = await params;
  return presentation(id, slug, await searchParams, false);
}
export async function PrivateCatalogCollectionPreview({ params, searchParams }: { params: Promise<{ sellerId: string; collectionId: string }>; searchParams: Promise<Search> }) {
  const { sellerId, collectionId } = await params;
  return presentation(sellerId, collectionId, await searchParams, true);
}
