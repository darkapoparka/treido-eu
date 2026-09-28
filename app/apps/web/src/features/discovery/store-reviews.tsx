"use client";
import { ShopSurface } from "./hydration-boundary";
/* eslint-disable @next/next/no-img-element -- Existing allowlisted reference crops. */
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconButton, Sheet, commitSheetQuery } from "./components";
import { Icon } from "./icons";
import { ContextualCloseLink } from "./return-navigation";
import { RatingInformation } from "./rating-information";
import { ReviewHelpful, ReviewReport, ReviewStars } from "./review-feedback";
import { useReviewFeedback } from "./review-state";
import {
  selectReviews,
  type ReviewRating,
  type ReviewSearchRecord,
  type ReviewSort,
} from "./review-model";

type StoreReview = ReviewSearchRecord & {
  productTitle: string;
  syntheticAuthor: string;
  dateLabel: string | null;
};
// Flow 39 and the existing allowlisted store-review artwork. Private inspection
// paths and crop coordinates are not part of the client-facing review contract.
const records: StoreReview[] = [
  {
    id: "store-review-1",
    syntheticAuthor: "Anne",
    dateLabel: "Yesterday",
    stars: 5,
    title: "Best shampoo set ever",
    productTitle: "Coconut Oil Shampoo & Conditioner Combo",
    body: "Before I started to use all my hair products I had a scalp problem but since I switched everything I use to",
  },
  {
    id: "store-review-2",
    syntheticAuthor: "Jill",
    dateLabel: "Yesterday",
    stars: 5,
    title: "Pleasant Surprise",
    productTitle: "Coastal Cottage Hair Perfume Duo",
    body: "I really enjoy these fragrances. Especially beach sorbet, so light and makes me feel happy. I keep in it my purse to apply in the",
  },
  {
    id: "store-review-3",
    syntheticAuthor: "Morgan",
    dateLabel: null,
    stars: 5,
    title: "Love Everything Kitsch",
    productTitle: "Tula Rose Hair & Body Perfume Mist",
    body: "I have a breathing issue and I like to smell good as well I can do that with Kitsch finally.",
  },
];

const sorts: ReviewSort[] = [
  "Most recent",
  "Most helpful",
  "Highest rating",
  "Lowest rating",
];
const ratings: ReviewRating[] = [5, 4, 3, 2, 1];
export function StoreReviews() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const sort =
    sorts.find((value) => value === params.get("sort")) ?? "Most recent";
  const rating =
    ratings.find((value) => value === Number(params.get("rating"))) ?? null;
  const [panel, setPanel] = useState("");
  const [report, setReport] = useState("");
  const lastReport = useRef("");
  const feedback = useReviewFeedback("store:kitsch");
  const { helpful, reported } = feedback;
  const visible = selectReviews(records, { query: q, sort, rating, helpful });
  function updateCriteria(patch: {
    q?: string;
    sort?: ReviewSort;
    rating?: ReviewRating | null;
  }) {
    const next = new URLSearchParams(params.toString());
    const query = patch.q ?? q;
    const order = patch.sort ?? sort;
    const selected = patch.rating === undefined ? rating : patch.rating;
    if (query) next.set("q", query);
    else next.delete("q");
    if (order === "Most recent") next.delete("sort");
    else next.set("sort", order);
    if (selected === null) next.delete("rating");
    else next.set("rating", String(selected));
    commitSheetQuery(next);
  }
  return (
    <ShopSurface className="shop-page store-reviews">
      <header className="section-heading">
        <h1>Reviews</h1>
        <ContextualCloseLink
          href="/stores/kitsch/info"
          className="icon-button"
          aria-label="Close reviews"
        >
          <Icon name="close" />
        </ContextualCloseLink>
      </header>
      <div className="store-review-summary">
        <b>4.5</b>
        <div>
          <ReviewStars rating={4.5} />
          <small>
            194.9K ratings <RatingInformation />
          </small>
        </div>
      </div>
      <div className="category-rail">
        <IconButton
          icon="filter-circles"
          label="Filter reviews"
          onClick={() => setPanel("Filter")}
        />
        <button className="pill" onClick={() => setPanel("Sort by")}>
          Sort by <Icon name="back" style={{ transform: "rotate(-90deg)" }} />
        </button>
        <button className="pill" onClick={() => setPanel("Rating")}>
          {rating === null ? "Rating" : `${rating} stars`}{" "}
          <Icon name="back" style={{ transform: "rotate(-90deg)" }} />
        </button>
      </div>
      {q.trim() && <p className="store-review-query">Search: {q}</p>}
      {!visible.length && (
        <div className="review-empty" role="status">
          <h2>No matching reviews</h2>
          <p>No captured reviews match these filters.</p>
          <button
            className="pill"
            onClick={() =>
              updateCriteria({ q: "", rating: null, sort: "Most recent" })
            }
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="store-review-list">
        {visible.map((review) => (
          <article
            key={review.id}
            data-review-id={review.id}
            aria-label={`Review by ${review.syntheticAuthor}`}
            className={reported[review.id] ? "review-reported" : ""}
          >
            <div className="store-review-product">
              <img
                src={`/api/reference-media/${review.id}`}
                alt={review.productTitle}
              />
              <div>
                <ReviewStars rating={review.stars} />
                <h2>{review.title}</h2>
                <small>{review.productTitle}</small>
              </div>
            </div>
            <p>{review.body}</p>
            <footer>
              <span className="review-avatar" aria-hidden="true">
                {review.syntheticAuthor[0]}
              </span>
              <span className="review-author">
                {review.syntheticAuthor}
                {review.dateLabel && <> &#183; {review.dateLabel}</>}
              </span>
              <ReviewHelpful
                selected={helpful.includes(review.id)}
                disabled={!!reported[review.id]}
                onToggle={() => feedback.toggleHelpful(review.id)}
              />
              <IconButton
                icon="more"
                label={`More options for ${review.title}`}
                onClick={() => {
                  lastReport.current = review.id;
                  setReport(review.id);
                }}
              />
            </footer>
            {reported[review.id] && (
              <small className="review-reported-label">
                You reported this review
              </small>
            )}
          </article>
        ))}
      </div>
      <ReviewReport
        open={!!report}
        onClose={() => setReport("")}
        onReopen={() => setReport(lastReport.current)}
        onReport={(reason) => feedback.markReported(lastReport.current, reason)}
      />
      <Sheet open={!!panel} title={panel} onClose={() => setPanel("")}>
        {panel === "Filter" ? (
          <>
            <label className="account-input">
              Search reviews
              <input
                value={q}
                type="search"
                onChange={(event) => updateCriteria({ q: event.target.value })}
                placeholder="Search reviews"
              />
            </label>
            <button
              className="primary form-submit"
              onClick={() => setPanel("")}
            >
              Done
            </button>
          </>
        ) : panel === "Sort by" ? (
          <div className="filter-options">
            {sorts.map((value) => (
              <button
                key={value}
                aria-pressed={sort === value}
                onClick={() => {
                  updateCriteria({ sort: value });
                  setPanel("");
                }}
              >
                {value}
                <span
                  className={`radio-outline ${sort === value ? "selected" : ""}`}
                />
              </button>
            ))}
          </div>
        ) : panel === "Rating" ? (
          <div className="filter-options">
            <button
              aria-pressed={rating === null}
              onClick={() => {
                updateCriteria({ rating: null });
                setPanel("");
              }}
            >
              All ratings
              <span
                className={`radio-outline ${rating === null ? "selected" : ""}`}
              />
            </button>
            {ratings.map((value) => (
              <button
                key={value}
                aria-pressed={rating === value}
                onClick={() => {
                  updateCriteria({ rating: value });
                  setPanel("");
                }}
              >
                {value} {value === 1 ? "star" : "stars"}
                <span
                  className={`radio-outline ${rating === value ? "selected" : ""}`}
                />
              </button>
            ))}
          </div>
        ) : null}
      </Sheet>
    </ShopSurface>
  );
}
