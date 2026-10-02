"use client";
import { displayCount } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import type { Product } from "../catalog/types";
import { FloatingNav } from "./components";
import { ShopSurface } from "./hydration-boundary";
import { ReviewStars } from "./review-feedback";

// A captured aggregate is not a source for individual review text. Products
// without their own recorded reviews must never inherit Shea or bag reviews.
export function ProductRatings({ product }: { product: Product }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  return (
    <ShopSurface className="shop-page">
      <h1>{ui("reviews")}</h1>
      <h2>{product.title}</h2>
      {product.rating !== undefined && (
        <p>
          <ReviewStars rating={product.rating} />{" "}
          {displayCount(product.ratingCount, intlLocale)} {ui("ratings")}
        </p>
      )}
      <p className="empty-state" role="status">
        {ui("theFullReviewListWasNotCapturedForThisProduct")}
      </p>
      <FloatingNav back />
    </ShopSurface>
  );
}
