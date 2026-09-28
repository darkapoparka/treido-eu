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
  return (
    <ProductDisclosure
      className="pdp-review-preview"
      title="Reviews"
      collapsible={collapsible}
      productId={productId}
    >
      <div className="review-summary">
        <div>
          <strong>{collapsible ? rating.toFixed(1) : rating}</strong>
          <ReviewStars
            rating={Math.round(rating * 2) / 2}
            label={`${rating} out of 5 stars`}
          />
          <p>{ratingCount} ratings</p>
        </div>
        <div className="rating-bars" aria-label="Rating distribution">
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
                ? "Only this part of the review was captured."
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
                  <small className="sr-only">Partially captured review</small>
                )}
              </footer>
            )}
          </article>
        ))}
      </div>
      <SourceLink href={`/products/${productId}/reviews`}>
        Read all reviews
      </SourceLink>
    </ProductDisclosure>
  );
}
