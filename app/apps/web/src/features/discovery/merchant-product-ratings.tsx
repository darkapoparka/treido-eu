"use client";
import { displayRating, displayCount } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import type { Catalog, Store } from "../catalog/types";
import { merchantProducts } from "../catalog/reference/merchant-catalog-model";
import { merchantPresentation } from "../catalog/seller-presentation";
import { SourceLink } from "./return-navigation";
import { MerchantPhoto } from "./native-merchant-chrome";
import { ReviewStars } from "./rating-stars";
/** Only this merchant's actual product ratings; never invented seller reviews. */
export function MerchantProductRatings({
  store,
  catalog,
}: {
  store: Store;
  catalog: Catalog;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  const products = merchantProducts(store, catalog).filter(
    (p) => p.rating !== undefined,
  );
  if (!products.length)
    return (
      <SourceLink
        className="native-merchant-return-products pill"
        href={`/stores/${store.id}#all-products`}
      >
        {ui("shopAll")}
      </SourceLink>
    );
  return (
    <section
      className="native-merchant-product-ratings"
      aria-label={ui("productRatings")}
      data-ui-label="productRatings"
    >
      <h2>{ui("productRatings")}</h2>
      {products.slice(0, 12).map((p) => (
        <SourceLink
          key={p.id}
          className="native-merchant-rating-product"
          href={`/products/${p.id}`}
        >
          <MerchantPhoto src={p.referenceThumbnails?.grid ?? p.images[0]} />
          <span>
            <strong>{p.title}</strong>
            <ReviewStars rating={p.rating!} />
            <small>
              {displayRating(p.rating, intlLocale)}{" "}
              {p.ratingCount
                ? `(${displayCount(p.ratingCount, intlLocale)})`
                : ""}
            </small>
          </span>
        </SourceLink>
      ))}
    </section>
  );
}
export function MerchantCatalogPreview({
  store,
  catalog,
}: {
  store: Store;
  catalog: Catalog;
}) {
  const ui = useTranslations("discoveryUI");
  const p = merchantPresentation(store),
    products = merchantProducts(store, catalog);
  if (p.source === "captured" || p.categories?.length || !products.length)
    return null;
  return (
    <SourceLink
      className="native-merchant-panel native-merchant-catalog-preview"
      href={`/stores/${store.id}#all-products`}
    >
      <h2>
        {ui("shopAll")} <span aria-hidden="true">›</span>
      </h2>
      <div>
        {products.slice(0, 3).map((product) => (
          <MerchantPhoto
            key={product.id}
            src={product.referenceThumbnails?.grid ?? product.images[0]}
          />
        ))}
      </div>
    </SourceLink>
  );
}
