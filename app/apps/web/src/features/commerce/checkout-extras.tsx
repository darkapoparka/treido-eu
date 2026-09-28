"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { formatMoney } from "../catalog/types";
import { Icon } from "../discovery/icons";
import { ReviewStars } from "../discovery/review-feedback";
export const kitschCheckoutRecommendations = [
  {
    id: "checkout-shea",
    name: "Shea Butter Exfoliating Body Wash",
    amount: 1400,
    image: "/api/reference-media/checkout-shea-photo",
    reviews: "2888",
  },
  {
    id: "checkout-rosemary-oil",
    name: "Strengthening Rosemary & Biotin Scalp & Hair Oil - 2fl oz./60mL",
    amount: 1500,
    image: "/api/reference-media/checkout-rosemary-oil",
    reviews: "1094",
  },
];
export type CheckoutRecommendation =
  (typeof kitschCheckoutRecommendations)[number];
export function checkoutRecommendationsForStore(
  storeId?: string,
): readonly CheckoutRecommendation[] {
  return storeId === "kitsch" ? kitschCheckoutRecommendations : [];
}
export function CheckoutExtras({
  recommendations,
  onAdd,
  added = [],
  disabled = false,
}: {
  recommendations: readonly CheckoutRecommendation[];
  onAdd?: (id: string) => void;
  added?: string[];
  disabled?: boolean;
}) {
  const [reverse, setReverse] = useState(false);
  const products = reverse ? [...recommendations].reverse() : recommendations;
  if (!products.length) return null;
  return (
    <section className="checkout-recommendations">
      <header>
        <h2>Don’t forget our most loved</h2>
        <button
          aria-label="Previous recommendations"
          disabled={disabled}
          onClick={() => setReverse(!reverse)}
        >
          <Icon name="arrow" style={{ transform: "rotate(180deg)" }} />
        </button>
        <button
          aria-label="Next recommendations"
          disabled={disabled}
          onClick={() => setReverse(!reverse)}
        >
          <Icon name="arrow" />
        </button>
      </header>
      {products.map((p) => (
        <article key={p.id}>
          <img src={p.image} alt="" />
          <div>
            <strong>{p.name}</strong>
            <p className="checkout-recommendation-rating">
              <ReviewStars rating={5} variant="rounded" />{" "}
              <em>{p.reviews} reviews</em>
            </p>
            <span>{formatMoney({ amount: p.amount, currency: "USD" })}</span>
          </div>
          <button
            disabled={disabled || added.includes(p.id)}
            onClick={() => onAdd?.(p.id)}
          >
            {added.includes(p.id) ? "Added" : "Add"}
          </button>
        </article>
      ))}
    </section>
  );
}
