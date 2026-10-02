"use client";
/* eslint-disable @next/next/no-img-element -- Existing seller and recommendation artwork. */
import { displayRating } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import type {
  ProductDetailProduct,
  ProductDetailSeller,
} from "../catalog/product-detail-model";
import type { ProductCardData } from "../catalog/card-model";
import { SourceLink } from "./return-navigation";
import { ProductCard } from "./product-card";
import { useDiscovery } from "./state";

export function ProductSellerRecommendations({
  product,
  store,
  related,
}: {
  product: Pick<ProductDetailProduct, "id" | "images" | "referenceStyle">;
  store?: ProductDetailSeller;
  related: readonly ProductCardData[];
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  const state = useDiscovery();
  const android = product.referenceStyle === "android",
    shea = product.id === "shea-butter",
    bag = product.id === "shampoo-bag";
  return (
    <>
      {store && !android && (
        <article
          className={`pdp-store-card ${shea || bag ? "pdp-kitsch-card" : ""}`}
        >
          <SourceLink
            startAtTop
            href={`/stores/${store.id}`}
            aria-label={ui("visitValue1", { value1: store.name ?? "" })}
          >
            <img
              src={
                shea || bag
                  ? "/api/reference-media/pdp-kitsch-art"
                  : product.images[0]
              }
              alt=""
            />
            <span className="pdp-store-identity">
              <strong>{store.name}</strong>
              <span>
                {displayRating(store.rating, intlLocale)} ★ (
                {shea ? "195K" : bag ? "195.2K" : store.ratingCount})
              </span>
            </span>
          </SourceLink>
          <button
            aria-pressed={state.followed.includes(store.id)}
            onClick={() => state.toggleFollow(store.id)}
          >
            {state.followed.includes(store.id) ? ui("following") : ui("follow")}
          </button>
        </article>
      )}
      {related.length > 0 && (
        <>
          <h2 className="pdp-related-heading">{ui("youMightAlsoLike")}</h2>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                showPromotion={shea}
                storeName={store?.name}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
