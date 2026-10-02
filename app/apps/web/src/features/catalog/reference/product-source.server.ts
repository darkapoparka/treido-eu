import "server-only";
import type { Product, Store } from "../types";
import { resolveReferenceScenario } from "./scenarios";

type Source<T> = () => Promise<readonly T[]>;
// Keep the same first-match precedence as adapter.server, without assembling Catalog.
const productSources: readonly Source<Product>[] = [
  async () => (await import("./catalog")).referenceCatalog.products,
  async () => (await import("./following-fixtures")).followingProducts,
  async () => (await import("./saved-fixtures")).savedProducts,
  async () => (await import("./store-fixtures")).storeProducts,
  async () => (await import("./detail-fixtures")).detailProducts,
  async () => (await import("./order-fixtures")).orderProducts,
];
const liveProducts: readonly Source<Product>[] = [
  async () => (await import("./live-shop-fixtures")).liveShopProducts,
  async () => (await import("./live-cozy-fixtures")).cozyProducts,
  async () => (await import("./live-staud-fixtures")).staudProducts,
  async () => (await import("./live-shelf-fixtures")).liveShelfProducts,
  async () =>
    (await import("./live-lower-shelf-fixtures")).liveLowerShelfProducts,
  async () => (await import("./live-living-room-fixtures")).livingRoomProducts,
];
const storeSources: readonly Source<Store>[] = [
  async () => (await import("./catalog")).referenceCatalog.stores,
  async () => (await import("./saved-fixtures")).savedStores,
  async () => (await import("./order-fixtures")).orderStores,
  async () => (await import("./deal-fixtures")).dealStores,
];
const liveStores: readonly Source<Store>[] = [
  async () => (await import("./live-shop-fixtures")).liveShopStores,
  async () => (await import("./live-cozy-fixtures")).cozyStores,
  async () => [(await import("./live-staud-fixtures")).staudStore],
  async () => (await import("./live-shelf-fixtures")).liveShelfStores,
  async () =>
    (await import("./live-lower-shelf-fixtures")).liveLowerShelfStores,
  async () => (await import("./live-living-room-fixtures")).livingRoomStores,
];
async function findRecords<T extends { readonly id: string }>(
  sources: readonly Source<T>[],
  ids: readonly string[],
): Promise<T[]> {
  const wanted = new Set(ids),
    found = new Map<string, T>();
  if (!wanted.size) return [];
  for (const load of sources) {
    for (const record of await load()) {
      if (wanted.delete(record.id)) found.set(record.id, record);
    }
    if (!wanted.size) break;
  }
  return [...new Set(ids)].flatMap((id) => {
    const record = found.get(id);
    return record ? [record] : [];
  });
}
function sourcesFor<T>(
  base: readonly Source<T>[],
  live: readonly Source<T>[],
  scenario?: string,
) {
  return resolveReferenceScenario(scenario) ? base : [...base, ...live];
}
async function projectProducts(
  products: readonly Product[],
  scenario?: string,
): Promise<readonly Product[]> {
  const resolved = resolveReferenceScenario(scenario);
  if (!resolved) return products;
  const { productDetailProjection } = await import("./detail-fixtures");
  const unavailable = new Set(resolved.catalog?.unavailableVariants ?? []);
  return productDetailProjection(products, scenario).map((product) =>
    unavailable.size
      ? {
          ...product,
          variants: product.variants.map((variant) =>
            unavailable.has(variant.id)
              ? { ...variant, availableQuantity: 0 }
              : variant,
          ),
        }
      : product,
  );
}
export async function readReferenceProducts(
  ids: readonly string[],
  scenario?: string,
) {
  return projectProducts(
    await findRecords(sourcesFor(productSources, liveProducts, scenario), ids),
    scenario,
  );
}
export async function readReferenceStores(
  ids: readonly string[],
  scenario?: string,
) {
  const records = await findRecords(
    sourcesFor(storeSources, liveStores, scenario),
    ids,
  );
  if (!resolveReferenceScenario(scenario)) return records;
  const { storefrontProjection } = await import("./store-fixtures");
  return storefrontProjection(records, scenario);
}
export async function readReferenceRelatedProducts(
  storeId: string,
  excludeId: string,
  scenario?: string,
) {
  const matches: Product[] = [];
  for (const load of sourcesFor(productSources, liveProducts, scenario)) {
    for (const product of await load()) {
      if (product.storeId === storeId && product.id !== excludeId)
        matches.push(product);
      if (matches.length === 4) return projectProducts(matches, scenario);
    }
  }
  return projectProducts(matches, scenario);
}
