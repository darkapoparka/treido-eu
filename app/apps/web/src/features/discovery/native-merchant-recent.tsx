"use client";
import { useTranslations } from "next-intl";
import type { Catalog, Store } from "../catalog/types";
import { merchantProducts } from "../catalog/reference/merchant-catalog-model";
import { merchantPresentation } from "../catalog/seller-presentation";
import { ProductCard } from "./components";
import { useDiscovery } from "./state";

/** Native merchant recents contain only actual visits to this seller's products. */
export function NativeMerchantRecent({
  store,
  catalog,
}: {
  store: Store;
  catalog: Catalog;
}) {
  const ui = useTranslations("discoveryUI");
  const { viewedProducts } = useDiscovery();
  const presentation = merchantPresentation(store);
  if (!presentation.showRecentlyViewed) return null;
  const own = new Map(
    merchantProducts(store, catalog).map((product) => [product.id, product]),
  );
  const products = viewedProducts.flatMap((id) => {
    const product = own.get(id);
    return product ? [product] : [];
  });
  if (!products.length) return null;
  return (
    <section
      className="native-merchant-panel native-merchant-recent"
      aria-label={ui("recentlyViewedAtValue1", { value1: store.name ?? "" })}
    >
      <h2>{ui("jumpBackIn")}</h2>
      <div className="product-rail">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            nativeIcons
            compact
            product={{ ...product, referenceStyle: "android" }}
          />
        ))}
      </div>
    </section>
  );
}
