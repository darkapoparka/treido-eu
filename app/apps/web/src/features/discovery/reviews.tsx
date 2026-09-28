"use client";
import { ShopSurface } from "./hydration-boundary";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StoreReviews } from "./store-reviews";
import "./review-parity.css";
import { useDiscovery } from "./state";
import { IconButton, Sheet, commitSheetQuery } from "./components";
import { Icon } from "./icons";
import { ContextualCloseLink } from "./return-navigation";
import { RatingInformation } from "./rating-information";
import { useSheetStages } from "./sheet-stages";
import {
  ReviewBody,
  ReviewHelpful,
  ReviewReport,
  ReviewStars,
} from "./review-feedback";
import { useReviewFeedback } from "./review-state";
import {
  selectReviews,
  type ReviewSearchRecord,
  type ReviewSort,
} from "./review-model";

// Frozen product-review flows 33–36; the extra search records are visible in
// b2a75fc0 frame 002. Only the absolute dates have known cross-record ordering.
// No capture timestamp is inferred from the relative date labels.
const reviews: (ReviewSearchRecord & { author: string; date: string })[] = [
  {
    id: "nice-excellent",
    stars: 5,
    searchOnly: true,
    searchOrder: 1,
    previewNewestOrder: 2,
    title: "Excellent product!",
    body: "I love this bar! It’s very moisturizing and smells heavenly. It’s great to use prior to applying a tanning product. It also makes a nice lather.",
    author: "Hester",
    date: "May 19, 2026",
  },
  {
    id: "nice-scent",
    stars: 4,
    searchOnly: true,
    searchOrder: 2,
    previewNewestOrder: 0,
    title: "",
    variant: "NC / OS",
    body: "This has a very lovely smell and exfoliates nicely",
    author: "Brittany",
    date: "Jun 16, 2026",
  },
  {
    id: "nice-short",
    stars: 5,
    searchOnly: true,
    searchOrder: 3,
    previewNewestOrder: 1,
    title: "",
    body: "Nice",
    author: "Denise",
    date: "Jun 7, 2026",
  },
  {
    id: "wes",
    stars: 5,
    title: "Girlfriend loves it and I can breathe .",
    body: "I think in the beauty industry the makers think all products need to have a fragrance . Being a man with allergies to perfumes . Thank god someone has finally brought a product to market that works and is fragrance free . I can finally go to bed and not have allergy issues . Thank you",
    author: "Wes",
    date: "13 days ago",
  },
  {
    id: "juanita",
    stars: 5,
    title: "How much I love your product",
    body: "I love the body soap you sent me and I use the liquid shampoo. I love it but it’s just great for my hair and everything I’ve had from you for all my hair products and all my ties and all I have loved everything.",
    author: "Juanita",
    date: "18 days ago",
  },
  {
    id: "tammy",
    stars: 5,
    searchOrder: 0,
    title: "",
    body: "This is truly one of the nicest soaps I have ever used. I have tried a few and I keep coming back to this one. Doesn’t dry out skin and rinses cleanly.",
    author: "Tygerr",
    date: "16 days ago",
  },
];

const reviewSorts: ReviewSort[] = [
  "Most relevant",
  "Most recent",
  "Highest rating",
  "Lowest rating",
];
export function Reviews({
  store = false,
  available = true,
  productId = "shea-butter",
}: {
  store?: boolean;
  available?: boolean;
  productId?: string;
}) {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const sort =
    reviewSorts.find((value) => value === params.get("sort")) ??
    "Most relevant";
  const feedback = useReviewFeedback(`product:${productId}`);
  const { helpful, reported, expanded } = feedback;
  const searchRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState("");
  const lastReport = useRef("");
  const [filter, setFilter] = useState(false);
  const visible = selectReviews(reviews, { query: q, sort, helpful });
  function updateCriteria(patch: { q?: string; sort?: ReviewSort }) {
    const next = new URLSearchParams(params.toString());
    const query = patch.q ?? q;
    const order = patch.sort ?? sort;
    if (query) next.set("q", query);
    else next.delete("q");
    if (order === "Most relevant") next.delete("sort");
    else next.set("sort", order);
    // The existing history owner also commits criteria underneath a sort sheet.
    // No RSC request or duplicate overlay entry is needed for local filtering.
    commitSheetQuery(next);
  }
  if (store && available) return <StoreReviews />;
  if (!available)
    return (
      <ShopSurface className="shop-page reviews-page">
        <header className="section-heading">
          <h1>Reviews</h1>
        </header>
        <p className="empty-state">
          Review records for this item are not available in this reference
          preview.
        </p>
        <Link href="/">Back to Shop</Link>
      </ShopSurface>
    );
  return (
    <ShopSurface className="shop-page reviews-page" data-product-id={productId}>
      <header className="section-heading">
        <h1>Reviews</h1>
        <ContextualCloseLink
          href={`/products/${productId}`}
          className="icon-button"
          aria-label="Close reviews"
        >
          <Icon name="close" />
        </ContextualCloseLink>
      </header>
      <div className="review-summary">
        <div>
          <strong>4.6</strong>
          <ReviewStars rating={4.5} label="4.6 out of 5 stars" />
          <p>
            3.3K ratings <RatingInformation />
          </p>
        </div>
        <div className="rating-bars" aria-label="Captured rating distribution">
          {[5, 4, 3, 2, 1].map((n, i) => (
            <div key={n}>
              <span>{n}</span>
              <i>
                <b style={{ width: `${[80, 9, 5, 3, 3][i]}%` }} />
              </i>
            </div>
          ))}
        </div>
      </div>
      <form
        className="review-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          searchRef.current?.blur();
        }}
      >
        <IconButton
          icon="filter-circles"
          label="Filter reviews"
          onClick={() => setFilter(true)}
        />
        <div className="review-search-field">
          <Icon name="search" />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search reviews"
            placeholder="Search"
            enterKeyHint="search"
            value={q}
            onChange={(event) => updateCriteria({ q: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape" && q) {
                event.preventDefault();
                updateCriteria({ q: "" });
              }
            }}
          />
        </div>
      </form>
      {!visible.length && (
        <div className="review-empty" role="status">
          <h2>No matching reviews</h2>
          <p>No captured reviews match this search.</p>
          <button
            className="pill"
            onClick={() => {
              updateCriteria({ q: "", sort: "Most relevant" });
              searchRef.current?.focus();
            }}
          >
            Clear search
          </button>
        </div>
      )}
      {visible.map((review) => (
        <article
          className={`review-card ${reported[review.id] ? "review-reported" : ""}`}
          key={review.id}
          data-review-id={review.id}
          aria-label={`Review by ${review.author}`}
        >
          <ReviewStars rating={review.stars} />
          {review.variant && (
            <small className="review-variant">{review.variant}</small>
          )}
          {review.title && <h2>{review.title}</h2>}
          <ReviewBody
            body={review.body}
            expanded={expanded.includes(review.id)}
            onToggle={() => feedback.toggleExpanded(review.id)}
          />
          <footer>
            <span className="review-avatar" aria-hidden="true">
              {review.author[0]}
            </span>
            <span className="review-author">
              {review.author} · {review.date}
            </span>
            <ReviewHelpful
              selected={helpful.includes(review.id)}
              disabled={!!reported[review.id]}
              onToggle={() => feedback.toggleHelpful(review.id)}
            />
            <IconButton
              icon="more"
              label={`More options for ${review.author}'s review`}
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
      <ReviewReport
        open={!!report}
        onClose={() => setReport("")}
        onReopen={() => setReport(lastReport.current)}
        onReport={(reason) => feedback.markReported(lastReport.current, reason)}
      />
      <Sheet
        open={filter}
        title="Filter reviews"
        onClose={() => setFilter(false)}
      >
        <div className="filter-options">
          {reviewSorts.map((value) => (
            <button
              key={value}
              aria-pressed={sort === value}
              onClick={() => {
                updateCriteria({ sort: value });
                setFilter(false);
              }}
            >
              {value}
              <span
                className={`radio-outline ${sort === value ? "selected" : ""}`}
              />
            </button>
          ))}
        </div>
        <p className="form-note">
          This preview contains a limited captured sample. Relative dates cannot
          be ordered against calendar dates.
        </p>
      </Sheet>
    </ShopSurface>
  );
}
export function ProductOptions({
  storeId,
  productId,
  open,
  onClose,
  onReopen,
  onReportNotesChange,
}: {
  storeId?: string;
  productId?: string;
  open: boolean;
  onClose: () => void;
  onReopen: () => void;
  onReportNotesChange?: (open: boolean) => void;
}) {
  const router = useRouter(),
    state = useDiscovery();
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">(
    "idle",
  );
  const firstReason = useRef<HTMLInputElement>(null);
  const selectedReason = useRef<HTMLInputElement>(null);
  const copyOperation = useRef(0);
  const contactTrigger = useRef<HTMLButtonElement>(null);
  const reportTrigger = useRef<HTMLButtonElement>(null);
  const previousView = useRef("menu");
  const flow = useSheetStages<
    "menu" | "contact" | "reason" | "notes" | "marked"
  >({
    open,
    initial: "menu",
    onClose,
    onReopen,
    onStart: () => {
      setReason("");
      setNotes("");
      setCopyState("idle");
    },
  });
  const view = flow.stage;
  useEffect(() => {
    onReportNotesChange?.(open && view === "notes");
  }, [open, view, onReportNotesChange]);
  useEffect(() => {
    if (!open) return;
    if (view === "menu" && previousView.current !== "menu") {
      (previousView.current === "contact"
        ? contactTrigger
        : reportTrigger
      ).current?.focus({ preventScroll: true });
    }
    if (view === "reason") firstReason.current?.focus({ preventScroll: true });
    if (view === "notes")
      selectedReason.current?.focus({ preventScroll: true });
    previousView.current = view;
  }, [open, view]);
  const close = () => {
    copyOperation.current += 1;
    flow.close();
  };
  const title =
    view === "menu"
      ? "More options"
      : view === "contact"
        ? "Contact KITSCH"
        : "Report product";
  function markProduct() {
    if (!reason) return;
    if (!productId || !storeId) {
      flow.navigate("marked");
      return;
    }
    state.reportProduct(productId);
    flow.close(() =>
      router.replace(
        `/stores/${encodeURIComponent(storeId)}?reported=${encodeURIComponent(productId)}#all-products`,
      ),
    );
  }
  return (
    <Sheet
      open={open}
      title={title}
      className={`product-options-sheet product-options-${view}`}
      onClose={close}
      manageHistory={false}
    >
      {view === "menu" ? (
        <div className="product-option-list">
          {storeId === "kitsch" && (
            <button
              ref={contactTrigger}
              onClick={() => flow.navigate("contact")}
            >
              <Icon name="chat-round" />
              Contact KITSCH
            </button>
          )}
          <button
            ref={reportTrigger}
            className="danger-text"
            onClick={() => flow.navigate("reason")}
          >
            <Icon name="alert" />
            Report
          </button>
        </div>
      ) : view === "contact" ? (
        <>
          <div className="product-option-list">
            <a href="https://www.mykitsch.com" target="_blank" rel="noreferrer">
              <Icon name="website" />
              Website
            </a>
            <button
              onClick={async () => {
                const operation = ++copyOperation.current;
                try {
                  if (!navigator.clipboard)
                    throw new Error("Clipboard unavailable");
                  await navigator.clipboard.writeText("kitsch@mykitsch.com");
                  if (copyOperation.current === operation)
                    setCopyState("copied");
                } catch {
                  if (copyOperation.current === operation)
                    setCopyState("unavailable");
                }
              }}
              aria-label="Copy kitsch@mykitsch.com"
            >
              <Icon name="mail" />
              kitsch@mykitsch.com
              <span className="contact-trailing">
                <Icon name={copyState === "copied" ? "check" : "copy"} />
              </span>
            </button>
            <a href="tel:+14242405551">
              <Icon name="phone" />
              4242405551
            </a>
            <a
              href="https://www.instagram.com/mykitsch/"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="instagram" />
              Instagram
            </a>
            <a
              href="https://www.facebook.com/mykitsch/"
              target="_blank"
              rel="noreferrer"
            >
              <Icon name="facebook-circle" />
              Facebook
            </a>
          </div>
          {copyState === "copied" && (
            <span className="sr-only" role="status">
              Email address copied
            </span>
          )}
          {copyState === "unavailable" && (
            <label className="contact-copy-fallback">
              Clipboard unavailable. Select and copy the email address.
              <input
                readOnly
                value="kitsch@mykitsch.com"
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          )}
          <p className="contact-address">
            137 N Larchmont Blvd, Suite 641, LOS ANGELES, California 90004,
            United States
          </p>
        </>
      ) : view === "reason" ? (
        <form
          className="product-report-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason) flow.navigate("notes");
          }}
        >
          <p className="product-report-subtitle">Please select a reason</p>
          <fieldset className="product-report-reasons">
            <legend className="sr-only">Please select a reason</legend>
            {[
              "Misleading",
              "Inappropriate content",
              "IP Infringement",
              "Other",
            ].map((value) => (
              <label key={value}>
                {value}
                <input
                  type="radio"
                  name="product-reason"
                  ref={
                    reason === value || (!reason && value === "Misleading")
                      ? firstReason
                      : undefined
                  }
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                />
              </label>
            ))}
          </fieldset>
          <div className="sheet-actions">
            <button type="button" className="pill" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!reason}>
              Next
            </button>
          </div>
        </form>
      ) : view === "notes" ? (
        <form
          className="product-report-form"
          onSubmit={(event) => {
            event.preventDefault();
            markProduct();
          }}
        >
          <p className="product-report-subtitle">Please select a reason</p>
          <label className="selected-report-reason">
            {reason}
            <input
              ref={selectedReason}
              type="radio"
              checked
              readOnly
              aria-label={reason}
            />
          </label>
          <textarea
            aria-label="Tell us more"
            placeholder="Tell us more"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className="product-report-optional">Optional</p>
          <div className="sheet-actions">
            <button type="button" className="pill" onClick={flow.back}>
              Back
            </button>
            <button
              type="submit"
              className="primary"
              title="Local preview only; no report will be sent"
            >
              Report
            </button>
          </div>
        </form>
      ) : (
        <p className="sheet-copy" role="status">
          This selection is marked in the local preview only. No report was
          sent.
        </p>
      )}
    </Sheet>
  );
}
