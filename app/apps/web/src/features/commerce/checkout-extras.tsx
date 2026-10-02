"use client";
/* eslint-disable @next/next/no-img-element */
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
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
  const intlLocale = useIntlLocale();
  const ui = useTranslations("commerceUI");
  const [reverse, setReverse] = useState(false);
  const products = reverse ? [...recommendations].reverse() : recommendations;
  if (!products.length) return null;
  return (
    <section className="checkout-recommendations">
      <header>
        <h2>{ui("donTForgetOurMostLoved")}</h2>
        <button
          aria-label={ui("previousRecommendations")}
          disabled={disabled}
          onClick={() => setReverse(!reverse)}
          data-ui-label="previousRecommendations"
        >
          <Icon name="arrow" style={{ transform: "rotate(180deg)" }} />
        </button>
        <button
          aria-label={ui("nextRecommendations")}
          disabled={disabled}
          onClick={() => setReverse(!reverse)}
          data-ui-label="nextRecommendations"
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
              <em>
                {p.reviews} {ui("reviews_546410")}
              </em>
            </p>
            <span>
              {formatMoney({ amount: p.amount, currency: "USD" }, intlLocale)}
            </span>
          </div>
          <button
            disabled={disabled || added.includes(p.id)}
            onClick={() => onAdd?.(p.id)}
          >
            {added.includes(p.id) ? ui("added") : ui("add")}
          </button>
        </article>
      ))}
    </section>
  );
}
