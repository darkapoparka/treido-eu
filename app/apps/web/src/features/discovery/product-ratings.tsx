"use client";
import type { Product } from "../catalog/types";
import { FloatingNav } from "./components";
import { ShopSurface } from "./hydration-boundary";
import { ReviewStars } from "./review-feedback";

// A captured aggregate is not a source for individual review text. Products
// without their own recorded reviews must never inherit Shea or bag reviews.
export function ProductRatings({ product }: { product: Product }) {
  return (
    <ShopSurface className="shop-page">
      <h1>Reviews</h1>
      <h2>{product.title}</h2>
      {product.rating !== undefined && (
        <p>
          <ReviewStars rating={product.rating} /> {product.ratingCount} ratings
        </p>
      )}
      <p className="empty-state" role="status">
        The full review list was not captured for this product.
      </p>
      <FloatingNav back />
    </ShopSurface>
  );
}
