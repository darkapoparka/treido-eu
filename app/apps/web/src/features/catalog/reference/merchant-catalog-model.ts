import type { Catalog, Store, Product } from "../types";
/** Same brand may enter through Home, editorial or a product; route IDs stay intact. */
export function merchantKey(store: Pick<Store, "name" | "id">): string {
  return (
    store.name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "") || store.id
  );
}
export function merchantProducts(store: Store, catalog: Catalog): Product[] {
  const key = merchantKey(store);
  const sellers = new Set(
    catalog.stores.filter((s) => merchantKey(s) === key).map((s) => s.id),
  );
  return catalog.products.filter((p) => sellers.has(p.storeId));
}
