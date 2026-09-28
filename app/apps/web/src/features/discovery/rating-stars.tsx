type RatingStarVariant = "standard" | "rounded";

export function RatingStar({
  variant = "standard",
}: {
  variant?: RatingStarVariant;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d={
          variant === "rounded"
            ? "M10.5 3.5Q12 1.2 13.5 3.5L16.1 7.8 20.7 8.9Q23.4 9.6 21.5 11.7L18.4 15.2 18.7 20Q18.9 22.8 16.3 21.7L12 19.8 7.7 21.7Q5.1 22.8 5.3 20L5.6 15.2 2.5 11.7Q.6 9.6 3.3 8.9L7.9 7.8Z"
            : "M12 1.5 15.1 8.7 23 9.4 17 14.6 18.8 22.3 12 18.2 5.2 22.3 7 14.6 1 9.4 8.9 8.7Z"
        }
      />
    </svg>
  );
}

function StarRow({ variant }: { variant: RatingStarVariant }) {
  return Array.from({ length: 5 }, (_, index) => (
    <RatingStar key={index} variant={variant} />
  ));
}

export function ReviewStars({
  rating,
  label,
  variant = "standard",
}: {
  rating: number;
  label?: string;
  variant?: RatingStarVariant;
}) {
  const fill = Math.max(0, Math.min(5, rating)) * 20;
  return (
    <span
      className="review-rating-stars"
      role="img"
      aria-label={label ?? `${rating} out of 5 stars`}
    >
      <span className="review-rating-stars-empty" aria-hidden="true">
        <StarRow variant={variant} />
      </span>
      <span
        className="review-rating-stars-fill"
        style={{ width: `${fill}%` }}
        aria-hidden="true"
      >
        <span>
          <StarRow variant={variant} />
        </span>
      </span>
    </span>
  );
}
