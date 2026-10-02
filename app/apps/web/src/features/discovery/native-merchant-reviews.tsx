"use client";
import { useTranslations } from "next-intl";
import { MerchantProductRatings } from "./merchant-product-ratings";
import { MerchantReviewMedia } from "./merchant-review-media";
import type { MerchantReviewMediaItem } from "../catalog/merchant-types";
import {
  MerchantReviewFilters,
  readMerchantRatings,
  merchantReviewSorts,
} from "./merchant-review-filters";
import { useRef, useState } from "react";
import { MerchantReviewReply } from "./merchant-review-reply";
import { useSearchParams } from "next/navigation";
import type { Store, Catalog } from "../catalog/types";
import { merchantPresentation } from "../catalog/seller-presentation";
import { MerchantShell, MerchantPhoto } from "./native-merchant-chrome";
import { SourceLink, ContextualCloseLink } from "./return-navigation";
import { IconButton, Sheet, commitSheetQuery } from "./components";
import { NativeIcon } from "./native-icons";
import { ReviewStars, ReviewReport } from "./review-feedback";
import { RatingInformation } from "./rating-information";
import { useReviewFeedback } from "./review-state";
import { selectReviews } from "./review-model";
function ReviewPhotos({
  photos,
  media,
}: {
  photos: readonly string[];
  media?: readonly MerchantReviewMediaItem[];
}) {
  const ui = useTranslations("discoveryUI");
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <>
      <div className="native-merchant-review-photos">
        {photos.map((src, i) => (
          <button
            key={src}
            aria-label={ui("openReviewPhotoValue1", { value1: i + 1 })}
            onClick={() => setSelected(i)}
          >
            <MerchantPhoto src={src} />
          </button>
        ))}
      </div>
      {media?.length ? (
        <MerchantReviewMedia
          items={media}
          selected={selected}
          onSelect={setSelected}
          onClose={() => setSelected(null)}
        />
      ) : (
        <Sheet
          open={selected !== null}
          title={ui("reviewPhoto")}
          onClose={() => setSelected(null)}
          className="native-merchant-photo-sheet"
        >
          <div
            onKeyDown={(e) => {
              if (e.key === "ArrowRight")
                setSelected((i) => Math.min(photos.length - 1, (i ?? 0) + 1));
              if (e.key === "ArrowLeft")
                setSelected((i) => Math.max(0, (i ?? 0) - 1));
            }}
          >
            {selected !== null && (
              <MerchantPhoto
                className="native-merchant-photo-expanded"
                src={photos[selected]}
                alt={ui("capturedReviewPhotoValue1", {
                  value1: selected + 1,
                })}
              />
            )}
            <div className="native-merchant-gallery-actions">
              <button
                disabled={selected === 0}
                onClick={() => setSelected((i) => Math.max(0, (i ?? 0) - 1))}
              >
                {ui("previousPhoto")}
              </button>
              <output>
                {(selected ?? 0) + 1} / {photos.length}
              </output>
              <button
                disabled={selected === photos.length - 1}
                onClick={() =>
                  setSelected((i) => Math.min(photos.length - 1, (i ?? 0) + 1))
                }
              >
                {ui("nextPhoto")}
              </button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
export function MerchantReviewOverview({ store }: { store: Store }) {
  const ui = useTranslations("discoveryUI");
  const p = merchantPresentation(store),
    rating = p.rating ?? store.rating;
  return (
    <section className="native-merchant-panel native-merchant-review-overview">
      <SourceLink
        className="native-merchant-panel-heading"
        href={`/stores/${store.id}/reviews`}
      >
        <h2>{ui("reviews")}</h2>
        <NativeIcon name="arrow" />
      </SourceLink>
      {rating !== undefined && (
        <SourceLink
          className="native-merchant-review-score"
          href={`/stores/${store.id}/reviews`}
        >
          <div>
            <b>{rating}</b>
            <small>
              {p.reviewCount ?? p.ratingCount ?? store.ratingCount}{" "}
              {ui("ratings")}
            </small>
          </div>
          <ReviewStars rating={rating} />
        </SourceLink>
      )}
      {!!p.reviewPhotos?.length && (
        <ReviewPhotos photos={p.reviewPhotos} media={p.reviewMedia} />
      )}
      {!!p.reviews?.length && (
        <div className="native-merchant-review-previews">
          {p.reviews.map((r) => (
            <SourceLink
              key={r.id}
              className="native-merchant-review-preview"
              href={`/stores/${store.id}/reviews`}
            >
              <ReviewStars rating={r.stars} />
              <span>{r.title}</span>
              <small>
                <i>{r.author[0]}</i>
                {r.author} · {r.date}
              </small>
            </SourceLink>
          ))}
        </div>
      )}
    </section>
  );
}

export function NativeStoreReviews({
  store,
  catalog,
}: {
  store: Store;
  catalog?: Catalog;
}) {
  const ui = useTranslations("discoveryUI");
  const p = merchantPresentation(store),
    params = useSearchParams(),
    [report, setReport] = useState(""),
    lastReport = useRef(""),
    [expanded, setExpanded] = useState<string[]>([]);
  const sort =
    merchantReviewSorts.find((value) => value === params.get("sort")) ??
    "Most relevant";
  const ratings = readMerchantRatings(params.get("rating"));
  const feedback = useReviewFeedback(`native-store:${store.id}`),
    visible = selectReviews(
      (p.reviews ?? []).filter(
        (review) => !ratings.length || ratings.includes(review.stars),
      ),
      {
        sort,
        query: params.get("q") ?? "",
        helpful: feedback.helpful,
      },
    );
  function clearFilters() {
    const params = new URLSearchParams(location.search);
    params.delete("sort");
    params.delete("rating");
    commitSheetQuery(params);
  }
  return (
    <MerchantShell store={store} kind="reviews">
      <header className="native-merchant-reviews-heading">
        <h1>{ui("reviews")}</h1>
        <ContextualCloseLink
          href={`/stores/${store.id}/info`}
          className="icon-button"
          aria-label={ui("closeReviews")}
          data-ui-label="closeReviews"
        >
          <NativeIcon name="close" />
        </ContextualCloseLink>
      </header>
      {(p.rating ?? store.rating) !== undefined && (
        <div className="native-merchant-reviews-summary">
          <b>{p.rating ?? store.rating}</b>
          <div>
            <ReviewStars rating={p.rating ?? store.rating ?? 0} />
            <small>
              {p.reviewCount ?? p.ratingCount ?? store.ratingCount}{" "}
              {ui("ratings")} <RatingInformation />
            </small>
          </div>
        </div>
      )}
      {!!p.reviewPhotos?.length && (
        <ReviewPhotos photos={p.reviewPhotos} media={p.reviewMedia} />
      )}
      <MerchantReviewFilters sort={sort} ratings={ratings} />

      <div className="native-merchant-review-list">
        {visible.map((r) => (
          <article key={r.id} data-review-id={r.id}>
            <div className="native-merchant-review-product">
              {r.image && <MerchantPhoto src={r.image} alt={r.productTitle} />}
              <div>
                <ReviewStars rating={r.stars} />
                <h2>{r.title}</h2>
                <small>{r.productTitle}</small>
              </div>
            </div>
            <p data-expanded={expanded.includes(r.id)}>{r.body}</p>
            {r.body.length > 110 && (
              <button
                className="native-merchant-read-more"
                aria-expanded={expanded.includes(r.id)}
                onClick={() =>
                  setExpanded((ids) =>
                    ids.includes(r.id)
                      ? ids.filter((id) => id !== r.id)
                      : [...ids, r.id],
                  )
                }
              >
                {expanded.includes(r.id) ? ui("readLess") : ui("readMore")}
              </button>
            )}
            <footer>
              <i>{r.author[0]}</i>
              <span>
                {r.author} · {r.date}
              </span>
              <IconButton
                native
                icon="more"
                label={ui("moreOptionsForValue1", { value1: r.title ?? "" })}
                onClick={() => {
                  lastReport.current = r.id;
                  setReport(r.id);
                }}
                data-ui-label="moreOptionsForValue1"
              />
            </footer>
            {r.reply && (
              <MerchantReviewReply
                {...r.reply}
                avatar={p.avatar || store.logo}
              />
            )}
            {feedback.reported[r.id] && (
              <small>{ui("youReportedThisReview")}</small>
            )}
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="native-merchant-review-empty" role="status">
          <h2>{p.reviews?.length ? ui("noMatchingReviews") : ui("reviews")}</h2>
          <p>
            {p.reviews?.length
              ? ui("noCapturedReviewsMatchTheseFilters")
              : ui("individualReviewsForThisMerchantHaveNotBeenCapturedIn")}
          </p>
          {(ratings.length > 0 || sort !== "Most relevant") && (
            <button className="pill" onClick={clearFilters}>
              {ui("clearFilters")}
            </button>
          )}
        </div>
      )}
      {!p.reviews?.length && catalog && (
        <MerchantProductRatings store={store} catalog={catalog} />
      )}
      <ReviewReport
        open={!!report}
        onClose={() => setReport("")}
        onReopen={() => setReport(lastReport.current)}
        onReport={(reason) => feedback.markReported(lastReport.current, reason)}
      />
    </MerchantShell>
  );
}
