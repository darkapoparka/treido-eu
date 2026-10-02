"use client";
import { useTranslations } from "next-intl";
import type { Catalog, Store } from "../catalog/types";
import { merchantKey } from "../catalog/reference/merchant-catalog-model";
import { SavedCard } from "./saved-card";
/** A captured listing remains a listing, not an invented purchasable variant. */
export function merchantCapturedListings(store: Store, catalog: Catalog) {
  const brand = merchantKey(store),
    ids = new Set(
      catalog.stores.filter((s) => merchantKey(s) === brand).map((s) => s.id),
    );
  const known = new Set(catalog.products.map((p) => p.id));
  return (catalog.savedListings ?? []).filter(
    (item) => ids.has(item.storeId) && !known.has(item.id),
  );
}
export function MerchantCapturedListings({
  store,
  catalog,
}: {
  store: Store;
  catalog: Catalog;
}) {
  const ui = useTranslations("discoveryUI");
  const items = merchantCapturedListings(store, catalog);
  if (!items.length) return null;
  return (
    <section
      className="native-merchant-bounded-listings"
      aria-label={ui("capturedProductsFromValue1", {
        value1: store.name ?? "",
      })}
    >
      <h2>{ui("products")}</h2>
      <div className="product-grid">
        {items.map((item) => (
          <SavedCard
            key={item.id}
            product={{ ...item, referenceStyle: "android" }}
            seller={store.name}
          />
        ))}
      </div>
    </section>
  );
}
