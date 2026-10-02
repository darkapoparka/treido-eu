"use client";
/* eslint-disable @next/next/no-img-element */
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { Product } from "../catalog/types";
import { ProductCard, IconButton, commitSheetQuery } from "./components";
import { StoreFilter, openStoreFilter } from "./store-filter";
import {
  readStoreFilters,
  selectStoreProducts,
  hasStoreFilters,
} from "./store-model";
import styles from "./store.module.css";
function UnidentifiedStorePhoto({ source }: { source: string }) {
  const ui = useTranslations("discoveryUI");
  return (
    <figure
      className={styles.unidentifiedGridPhoto}
      data-source-boundary="unidentified-store-product"
    >
      <img src={source} alt={ui("partiallyCapturedProductPhotograph")} />
      <figcaption className="sr-only">
        {ui("theProductIdentityAndRemainingPhotographWereNotCapturedNo")}
      </figcaption>
    </figure>
  );
}
export function StoreGrid({
  products,
  heading = true,
  native = false,
  defaultInStockOnly,
  inStockProductIds,
  promotions = false,
  sourceTail = false,
  unidentifiedPhotos = [],
}: {
  products: Product[];
  heading?: boolean;
  native?: boolean;
  defaultInStockOnly?: boolean;
  inStockProductIds?: readonly string[];
  promotions?: boolean;
  sourceTail?: boolean;
  unidentifiedPhotos?: readonly string[];
}) {
  const ui = useTranslations("discoveryUI");
  const params = useSearchParams();
  const initialStock = defaultInStockOnly ?? !native;
  const filters = readStoreFilters(params, initialStock);
  const filtered = selectStoreProducts(products, filters, inStockProductIds);
  const capturedFilterTail =
    filters.sale &&
    filters.stock &&
    filters.min === 0 &&
    filters.max === 380 &&
    filters.sort === "Best selling";
  const capturedTail = sourceTail || capturedFilterTail;
  return (
    <>
      {heading && (
        <div className="store-grid-heading">
          <h2>{ui("allProducts")}</h2>
          <IconButton
            icon="filter-circles"
            label={ui("filterStoreProducts")}
            onClick={() => openStoreFilter("all", initialStock)}
            data-ui-label="filterStoreProducts"
          />
        </div>
      )}
      <div className="product-grid">
        {filtered.map((p) =>
          capturedTail && ["shampoo-bag", "terracotta"].includes(p.id) ? (
            <UnidentifiedStorePhoto
              key={`source-fragment-${p.id === "shampoo-bag" ? "left" : "right"}`}
              source={`/api/reference-media/store-arrival-tail-${p.id === "shampoo-bag" ? "left" : "right"}`}
            />
          ) : (
            <ProductCard
              key={p.id}
              nativeIcons={native}
              product={
                sourceTail && p.id === "shea-butter"
                  ? {
                      ...p,
                      images: [
                        "/api/reference-media/store-source-reported-shea",
                      ],
                    }
                  : native
                    ? { ...p, referenceStyle: "android" }
                    : p
              }
              showPromotion={promotions}
            />
          ),
        )}
        {!hasStoreFilters(filters, initialStock) &&
          unidentifiedPhotos.map((source) => (
            <UnidentifiedStorePhoto key={source} source={source} />
          ))}
      </div>
      {!filtered.length && (
        <div className="empty-state" role="status">
          <p>{ui("noMatchingProductsInThisReference")}</p>
          {hasStoreFilters(filters, initialStock) && (
            <button
              className="pill store-search-recovery"
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                for (const key of ["min", "max", "sale", "stock", "sort"])
                  next.delete(key);
                commitSheetQuery(next);
              }}
            >
              {ui("clearFilters")}
            </button>
          )}
        </div>
      )}
      <StoreFilter defaultInStockOnly={initialStock} />
    </>
  );
}
