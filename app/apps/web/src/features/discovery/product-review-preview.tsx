import { useTranslations } from "next-intl";
import { SourceLink } from "./return-navigation";
import { ReviewStars } from "./review-feedback";
import { ProductDisclosure } from "./product-disclosure";

type Preview = {
  title: string;
  rating: number;
  author?: string;
  initial?: string;
  date?: string;
  partial?: boolean;
};

export function ProductReviewPreview({
  productId,
  rating,
  ratingCount,
  distribution,
  reviews,
  collapsible = false,
  cardWidth,
}: {
  productId: string;
  rating: number;
  ratingCount: string;
  distribution: readonly number[];
  reviews: readonly Preview[];
  collapsible?: boolean;
  cardWidth?: number;
}) {
  const ui = useTranslations("discoveryUI");
  return (
    <ProductDisclosure
      className="pdp-review-preview"
      title={ui("reviews")}
      collapsible={collapsible}
      productId={productId}
    >
      <div className="review-summary">
        <div>
          <strong>{collapsible ? rating.toFixed(1) : rating}</strong>
          <ReviewStars
            rating={Math.round(rating * 2) / 2}
            label={ui("value1OutOf5Stars", { value1: rating ?? "" })}
          />
          <p>
            {ratingCount} {ui("ratings")}
          </p>
        </div>
        <div
          className="rating-bars"
          aria-label={ui("ratingDistribution")}
          data-ui-label="ratingDistribution"
        >
          {[5, 4, 3, 2, 1].map((value, index) => (
            <div key={value}>
              <span>{value}</span>
              <i>
                <b
                  style={{
                    width: `${Math.max(0, Math.min(100, distribution[index] ?? 0))}%`,
                  }}
                />
              </i>
            </div>
          ))}
        </div>
      </div>
      <div
        className="pdp-review-rail"
        data-native-width={cardWidth || undefined}
      >
        {reviews.map((review) => (
          <article
            key={review.title}
            // Anchor the absolutely positioned accessible label to this card,
            // not the document beyond the horizontal scroller's clipping box.
            style={{
              position: "relative",
              ...(cardWidth
                ? {
                    flexBasis: `min(${cardWidth}px, 100%)`,
                    width: `min(${cardWidth}px, 100%)`,
                  }
                : {}),
            }}
            title={
              review.partial
                ? ui("onlyThisPartOfTheReviewWasCaptured")
                : undefined
            }
          >
            <ReviewStars rating={review.rating} />
            <p>{review.title}</p>
            {(review.author || review.initial) && (
              <footer className="pdp-preview-reviewer">
                <span aria-hidden="true">
                  {review.initial ?? review.author?.[0]}
                </span>
                {review.author}
                {review.date && <> · {review.date}</>}
                {review.partial && (
                  <small className="sr-only">
                    {ui("partiallyCapturedReview")}
                  </small>
                )}
              </footer>
            )}
          </article>
        ))}
      </div>
      <SourceLink href={`/products/${productId}/reviews`}>
        {ui("readAllReviews")}
      </SourceLink>
    </ProductDisclosure>
  );
}
