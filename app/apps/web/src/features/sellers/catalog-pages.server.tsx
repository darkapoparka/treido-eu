import "server-only";
import { notFound } from "next/navigation";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "./backend-status.server";
import { BackendUnavailable } from "./workspace";
import { requirePageIdentity, readPrivatePage, recoveryKey } from "./page-context.server";
import { readSellerContext } from "./persistence.server";
import { getDatabase } from "../../server/db/database";
import { readCatalogCollections, readCatalogCollection, readCatalogProducts } from "./catalog-organization.server";
import { CatalogCollections } from "./catalog-collections";
import { CatalogCollectionEditor } from "./catalog-collection-editor";
import { CatalogProducts } from "./catalog-products";
import { BulkProductEditor } from "./bulk-product-editor";
import { readBulkProductRows } from "./bulk-product-edit.server";
import { parseCatalogSelection } from "./catalog-navigation";

type Search = Record<string, string | string[] | undefined>;
const text = (value: string | string[] | undefined) => typeof value === "string" ? value : undefined;
export async function CatalogIndexPage({ params, searchParams, mode }: {
  params: Promise<{ sellerId: string }>; searchParams: Promise<Search>; mode: "collections" | "catalog";
}) {
  if (!backendConfigured()) return <BackendUnavailable />;
  const { sellerId } = await params, query = await searchParams;
  const language = await pageLocale(query.lang);
  const identity = await requirePageIdentity(`/app/sellers/${sellerId}/${mode}?lang=${language}`);
  const database = getDatabase();
  const common = await readPrivatePage(async () => ({
    seller: await readSellerContext(database, identity, sellerId, "listing.read"),
    collections: await readCatalogCollections(database, identity, sellerId, mode === "collections" ? { q: text(query.q), after: text(query.after) } : {}),
  }));
  const props = { sellerId, actorSubject: identity.subject, language, canWrite: common.seller.capabilities.includes("listing.write"), bufferKey: recoveryKey(identity.subject, `${sellerId}/${mode}`) };
  const key = `${identity.subject}/${sellerId}/${language}/${mode}`;
  if (mode === "collections") return <CatalogCollections key={key} {...props} initial={common.collections} q={text(query.q)} after={text(query.after)} />;
  const products = await readPrivatePage(() => readCatalogProducts(database, identity, sellerId, { q: text(query.q), after: text(query.after) }));
  return <CatalogProducts key={key} {...props} initial={products} collections={common.collections} q={text(query.q)} after={text(query.after)} canImport={common.seller.kind === "business" && common.seller.capabilities.includes("import.run")} />;
}
export async function CatalogCollectionPage({ params, searchParams }: {
  params: Promise<{ sellerId: string; collectionId: string }>; searchParams: Promise<Search>;
}) {
  if (!backendConfigured()) return <BackendUnavailable />;
  const { sellerId, collectionId } = await params;
  const language = await pageLocale((await searchParams).lang);
  const identity = await requirePageIdentity(`/app/sellers/${sellerId}/collections/${collectionId}?lang=${language}`);
  const database = getDatabase();
  const { seller, collection, products } = await readPrivatePage(async () => ({
    seller: await readSellerContext(database, identity, sellerId, "listing.read"),
    collection: await readCatalogCollection(database, identity, sellerId, collectionId),
    products: await readCatalogProducts(database, identity, sellerId, { collectionId, membersOnly: true }),
  }));
  return <CatalogCollectionEditor key={`${identity.subject}/${sellerId}/${collectionId}/${language}`} sellerId={sellerId} actorSubject={identity.subject} bufferKey={recoveryKey(identity.subject, `${sellerId}/collections/${collectionId}`)} language={language} canWrite={seller.capabilities.includes("listing.write")} initial={collection} initialProducts={products} />;
}
export async function CatalogBulkEditPage({ params, searchParams }: {
  params: Promise<{ sellerId: string }>; searchParams: Promise<Search>;
}) {
  if (!backendConfigured()) return <BackendUnavailable />;
  const { sellerId } = await params, query = await searchParams;
  const ids = parseCatalogSelection(text(query.ids));
  if (!ids) notFound();
  const language = await pageLocale(query.lang);
  const search = new URLSearchParams({ lang: language, ids: ids.join(",") });
  const identity = await requirePageIdentity(`/app/sellers/${sellerId}/catalog/edit?${search}`);
  const database = getDatabase();
  const { seller, products } = await readPrivatePage(async () => ({
    seller: await readSellerContext(database, identity, sellerId, "listing.read"),
    products: await readBulkProductRows(database, identity, sellerId, ids.join(",")),
  }));
  return <BulkProductEditor key={`${identity.subject}/${sellerId}/${ids.join()}/${language}`} sellerId={sellerId} actorSubject={identity.subject} bufferKey={recoveryKey(identity.subject, `${sellerId}/catalog/edit`)} language={language} canWrite={seller.capabilities.includes("listing.write")} initial={products} />;
}
