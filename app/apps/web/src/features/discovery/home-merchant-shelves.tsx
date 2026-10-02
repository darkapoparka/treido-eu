"use client";
import { displayCount } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { formatMoney, type Catalog, type Product } from "../catalog/types";
import { ProductCard, StoreRow } from "./components";
import { SourceLink } from "./return-navigation";
import { ReviewStars } from "./rating-stars";
import { Icon } from "./icons";
import "./home-merchant-shelves.css";

/** Android merchant shelves share the existing product and navigation owners. */
export function HomeMerchantShelves({
  catalog,
  hidden,
  recommendation,
  onMore,
  onUndo,
}: {
  catalog: Catalog;
  hidden: readonly string[];
  recommendation?: Product;
  onMore: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  const storeIds = catalog.liveHomeStoreIds ?? [];
  const interested =
    recommendation?.referenceStyle === "android" &&
    storeIds.includes(recommendation.storeId)
      ? recommendation
      : undefined;
  // The native return state leads with the last viewed product's merchant.
  // This is local continuity, not a claim to reproduce Shop's ranking service.
  const orderedIds = interested
    ? [
        interested.storeId,
        ...storeIds.filter((id) => id !== interested.storeId),
      ]
    : storeIds;
  return (
    <div className="home-merchant-shelves">
      {orderedIds.map((id) => {
        const store = catalog.stores.find((item) => item.id === id);
        if (!store) return null;
        const product = interested?.storeId === id ? interested : undefined;
        const products = catalog.products
          .filter((item) => item.storeId === id)
          .slice(0, 3);
        return (
          <section
            className={`android-merchant-card ${product ? "android-still-interested" : ""}`}
            key={id}
            data-merchant-id={id}
            aria-label={store.name}
          >
            <StoreRow store={store} onMore={() => onMore(id)} />
            {hidden.includes(id) ? (
              <div className="hidden-shop">
                <Icon name="eye-off" />
                <p>{ui("weLlShowYouLessLikeThis")}</p>
                <button type="button" onClick={() => onUndo(id)}>
                  {ui("undo")}
                </button>
              </div>
            ) : product ? (
              <div className="android-interest-product">
                <ProductCard product={product} compact />
                <SourceLink
                  href={`/products/${product.id}`}
                  className="android-interest-copy"
                >
                  <strong>{product.title}</strong>
                  {product.rating !== undefined && product.ratingCount && (
                    <span className="rating">
                      <ReviewStars rating={product.rating} /> (
                      {displayCount(product.ratingCount, intlLocale)})
                    </span>
                  )}
                  <span>
                    {formatMoney(product.price, intlLocale)}
                    {product.compareAt && (
                      <>
                        {" "}
                        <del>{formatMoney(product.compareAt, intlLocale)}</del>
                      </>
                    )}
                  </span>
                </SourceLink>
              </div>
            ) : (
              <div
                className="product-rail"
                aria-label={store.name + " products"}
              >
                {products.map((item) => (
                  <ProductCard key={item.id} product={item} compact />
                ))}
              </div>
            )}
            <SourceLink
              href={product ? `/products/${product.id}` : `/stores/${id}`}
              className="merchant-shop-all"
              aria-label={
                product
                  ? `View ${product.title} again`
                  : `Shop all at ${store.name}`
              }
            >
              <strong>{product ? ui("stillInterested") : ui("shopAll")}</strong>
              <span>
                <Icon name="arrow" />
              </span>
            </SourceLink>
          </section>
        );
      })}
    </div>
  );
}
