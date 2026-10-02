/* eslint-disable @next/next/no-img-element -- Existing reference promotion artwork. */
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import { formatMoney, type Money, type ProductVariant } from "../catalog/types";
import styles from "./product-detail.module.css";

export function ProductPriceSummary({
  product,
  selected,
  variant,
  price,
  capturedSpendOffer,
  onDetails,
}: {
  product: ProductDetailProduct;
  selected?: ProductVariant;
  variant: string;
  price: Money;
  capturedSpendOffer: string;
  onDetails: (title: string) => void;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  const android = product.referenceStyle === "android";
  const nativeSoldOut =
    android &&
    Boolean(
      selected?.referenceUnavailable || selected?.referenceColor?.unavailable,
    );
  const shea = product.id === "shea-butter",
    bag = product.id === "shampoo-bag";
  return (
    <>
      {product.detail?.lowStock && (
        <p className={styles.stockNotice}>
          <strong>{ui("almostGone")}</strong> {ui("thisItemIsLowInStock")}
        </p>
      )}
      {android &&
        product.detail?.referenceBadge &&
        (!product.detail.referenceBadgeVariantId ||
          product.detail.referenceBadgeVariantId === variant) && (
          <p
            className="native-product-badge"
            data-tone={product.detail.referenceBadgeTone}
          >
            {product.detail.referenceBadge}
            {product.detail.referenceStockBadge?.variantId === variant && (
              <span className="native-stock-badge">
                {product.detail.referenceStockBadge.label}
              </span>
            )}
          </p>
        )}
      <p
        className="product-price"
        data-native-sold-out={nativeSoldOut || undefined}
      >
        {nativeSoldOut ? (
          <>
            <del>{formatMoney(price, intlLocale)}</del>{" "}
            <strong>{ui("soldOut")}</strong>
          </>
        ) : (
          <>
            {formatMoney(price, intlLocale)}{" "}
            {(selected?.referenceCompareAt ?? product.compareAt) && (
              <del>
                {formatMoney(
                  (selected?.referenceCompareAt ?? product.compareAt)!,
                  intlLocale,
                )}
              </del>
            )}
          </>
        )}
        {product.detail?.markdownLabel && (
          <>
            {" "}
            <span className={styles.markdown}>
              {product.detail.markdownLabel}
            </span>
          </>
        )}
      </p>
      {product.detail?.arrivalLabel && (
        <p className={styles.arrival}>{product.detail.arrivalLabel}</p>
      )}
      {(shea || bag || product.promotion) && (
        <button
          className="product-deal"
          onClick={() => onDetails("Offer details")}
        >
          <img
            src={`/api/reference-media/${product.detail?.promotionIcon === "plain-bag" ? "dress-deal-tag" : "deal-tag"}`}
            alt=""
          />
          <span>
            <strong
              className={product.promotion ? styles.promotionTitle : undefined}
            >
              {product.promotion ?? capturedSpendOffer}
            </strong>
            <span>
              {product.detail?.promotionTerms ?? ui("exclusiveToShop")}
            </span>
          </span>
        </button>
      )}
    </>
  );
}
