"use client";
/* eslint-disable @next/next/no-img-element -- Existing allowlisted reference crops. */
import { displayRating, displayCount } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import type { CSSProperties, MouseEventHandler, ReactNode, Ref } from "react";
import type { ProductCardData } from "../catalog/card-model";
import { formatMoney } from "../catalog/types";
import { SourceLink } from "./return-navigation";
import { useDiscovery } from "./state";
import { Icon } from "./icons";
import { IconButton } from "./icon-button";
import { ReviewStars } from "./rating-stars";
import { PublicListingImage } from "./public-image";

export function SaveButton({
  product,
  native = false,
}: {
  product: Pick<ProductCardData, "id" | "title">;
  native?: boolean;
}) {
  const ui = useTranslations("discoveryUI");
  const state = useDiscovery();
  return (
    <IconButton
      className="save-button"
      native={native}
      icon="heart"
      label={`${state.saved.includes(product.id) ? ui("unsave") : ui("save")} ${product.title}`}
      pressed={state.saved.includes(product.id)}
      onClick={() => state.toggleSaved(product.id)}
    />
  );
}
export function ProductCard({
  product,
  compact = false,
  showPromotion = false,
  showRating = true,
  showSave = true,
  saveControl,
  mediaOnly = false,
  storeName,
  ratingStyle = "stars",
  ratingStars,
  partialRatingStars,
  nativeIcons = false,
  observation,
  mediaLabel,
  publicMedia = false,
}: {
  product: ProductCardData;
  compact?: boolean;
  showPromotion?: boolean;
  showRating?: boolean;
  showSave?: boolean;
  saveControl?: ReactNode;
  mediaOnly?: boolean;
  storeName?: string;
  ratingStyle?: "stars" | "summary";
  /** The depicted star fill when a shelf snapshot differs from product details. */
  ratingStars?: number;
  /** Only these filled stars were visible; the full rating and count are unknown. */
  partialRatingStars?: number;
  nativeIcons?: boolean;
  /** Real placement observation uses the existing article, not a layout wrapper. */
  observation?: {
    ref: Ref<HTMLElement>;
    onClick?: MouseEventHandler<HTMLElement>;
  };
  mediaLabel?: ReactNode;
  publicMedia?: boolean;
}) {
  const intlLocale = useIntlLocale();
  const inventoryText = useTranslations("inventory");
  const ui = useTranslations("discoveryUI");
  const discovery = useDiscovery();
  const reported =
    !saveControl && discovery.reportedProducts.includes(product.id);
  const markdown =
    product.referenceStyle === "android" &&
    !product.promotion &&
    product.compareAt?.currency === product.price.currency &&
    product.compareAt.amount > product.price.amount
      ? Math.round(
          (100 * (product.compareAt.amount - product.price.amount)) /
            product.compareAt.amount,
        )
      : undefined;
  const showMarkdown = showPromotion && !compact && markdown !== undefined;
  const photo =
    product.referenceThumbnails?.[compact ? "shelf" : "grid"] ??
    product.images[0];
  return (
    <article
      ref={observation?.ref}
      onClick={observation?.onClick}
      className={`product-card ${compact ? "compact" : ""}`}
      data-product-id={product.id}
      data-native-photo={
        product.referenceImageTreatment === "native" || undefined
      }
    >
      <div className="product-media">
        <SourceLink
          href={`/products/${product.id}`}
          startAtTop={product.referenceStyle === "android"}
          aria-label={product.images[0] ? undefined : product.title}
        >
          {publicMedia ? (
            <PublicListingImage src={product.images[0]} alt={product.title} />
          ) : product.images[0] ? (
            <img
              className={reported ? "product-reported-media" : ""}
              src={photo}
              srcSet={
                product.referenceThumbnails
                  ? `${photo} 1x, ${photo}-3x 3x`
                  : undefined
              }
              alt={product.title}
            />
          ) : (
            <span className="sr-only">
              {ui("productPhotographWasNotIncludedInTheReference")}
            </span>
          )}
        </SourceLink>
        {reported && (
          <span className="product-reported-mark">
            <Icon name="eye-off" />
          </span>
        )}
        {(compact || (showPromotion && product.promotion) || showMarkdown) && (
          <span
            className={`price-badge ${product.promotion ? "deal" : ""}`}
            data-reference-markdown={showMarkdown || undefined}
          >
            {showMarkdown
              ? `${markdown}% off`
              : (product.promotion ??
                (product.priceFrom
                  ? inventoryText("from", {
                      price: formatMoney(product.price, intlLocale),
                    })
                  : formatMoney(product.price, intlLocale)))}
            {!showMarkdown &&
              product.referenceStyle === "android" &&
              product.compareAt && (
                <del>{formatMoney(product.compareAt, intlLocale)}</del>
              )}
          </span>
        )}
        {showSave &&
          !reported &&
          (saveControl ?? (
            <SaveButton product={product} native={nativeIcons} />
          ))}
        {mediaLabel}
      </div>
      {!compact && !mediaOnly && (
        <SourceLink
          href={`/products/${product.id}`}
          className="product-copy"
          startAtTop={product.referenceStyle === "android"}
        >
          {storeName && <span className="product-seller">{storeName}</span>}
          <strong>{product.title}</strong>
          {showRating &&
            (product.ratingCount || partialRatingStars !== undefined) && (
              <span
                className="rating"
                data-partial-rating={
                  partialRatingStars !== undefined || undefined
                }
                style={
                  partialRatingStars === undefined
                    ? undefined
                    : ({
                        "--partial-rating-stars": partialRatingStars,
                      } as CSSProperties)
                }
              >
                {ratingStyle === "summary" ? (
                  <>
                    ★ {displayRating(product.rating, intlLocale)} ·{" "}
                    {displayCount(product.ratingCount, intlLocale)}{" "}
                    {ui("reviews_546410")}
                  </>
                ) : (
                  <>
                    <ReviewStars
                      rating={ratingStars ?? product.rating ?? 5}
                      label={
                        partialRatingStars !== undefined
                          ? ui(
                              "partiallyCapturedStarsFullRatingAndReviewCountUnavailable",
                            )
                          : ratingStars === undefined &&
                              product.rating === undefined
                            ? ui("capturedRating")
                            : undefined
                      }
                    />{" "}
                    {product.ratingCount &&
                      `(${displayCount(product.ratingCount, intlLocale)})`}
                  </>
                )}
              </span>
            )}
          <span>
            {product.priceFrom
              ? inventoryText("from", {
                  price: formatMoney(product.price, intlLocale),
                })
              : formatMoney(product.price, intlLocale)}{" "}
            {showPromotion && product.compareAt && (
              <del>{formatMoney(product.compareAt, intlLocale)}</del>
            )}
          </span>
        </SourceLink>
      )}
    </article>
  );
}
