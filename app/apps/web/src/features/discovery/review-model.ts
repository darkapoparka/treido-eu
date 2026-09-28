export type ReviewSort =
  | "Most relevant"
  | "Most recent"
  | "Most helpful"
  | "Highest rating"
  | "Lowest rating";

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export type ReviewSearchRecord = {
  id: string;
  title: string;
  body: string;
  stars: ReviewRating;
  variant?: string;
  productTitle?: string;
  searchOnly?: boolean;
  searchOrder?: number;
  // Local fixture ordering, not a reconstructed capture timestamp. In
  // particular, relative labels must not be anchored to an invented date.
  previewNewestOrder?: number;
};

export function normalizeReviewQuery(query: string): string {
  return query.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function selectReviews<T extends ReviewSearchRecord>(
  records: readonly T[],
  {
    query = "",
    sort = "Most relevant",
    rating = null,
    helpful = [],
  }: {
    query?: string;
    sort?: ReviewSort;
    rating?: ReviewRating | null;
    helpful?: readonly string[];
  } = {},
): T[] {
  const normalized = normalizeReviewQuery(query);
  const words = normalized.split(" ").filter(Boolean);
  const votes = new Set(helpful);
  return records
    .map((review, index) => ({ review, index }))
    .filter(({ review }) => {
      if (
        !normalized &&
        rating === null &&
        sort === "Most relevant" &&
        review.searchOnly
      )
        return false;
      if (rating !== null && review.stars !== rating) return false;
      const text = normalizeReviewQuery(
        `${review.title} ${review.body} ${review.variant ?? ""} ${review.productTitle ?? ""}`,
      );
      return words.every((word) => text.includes(word));
    })
    .sort((a, b) => {
      let order = 0;
      if (sort === "Highest rating") order = b.review.stars - a.review.stars;
      else if (sort === "Lowest rating")
        order = a.review.stars - b.review.stars;
      else if (sort === "Most helpful")
        order = Number(votes.has(b.review.id)) - Number(votes.has(a.review.id));
      else if (sort === "Most recent")
        order =
          (a.review.previewNewestOrder ?? Number.MAX_SAFE_INTEGER) -
          (b.review.previewNewestOrder ?? Number.MAX_SAFE_INTEGER);
      else if (normalized)
        order =
          (a.review.searchOrder ?? a.index) - (b.review.searchOrder ?? b.index);
      return order || a.index - b.index;
    })
    .map(({ review }) => review);
}
