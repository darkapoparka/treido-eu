"use client";
/* eslint-disable @next/next/no-img-element -- Frozen source photography. */
import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "../catalog/types";
import {
  capturedJeansContinuation,
  type CapturedSearchListing,
} from "../catalog/reference/search-fixtures";
import { IconButton, Sheet } from "./components";
import { useDiscovery } from "./state";
import styles from "./search-entry.module.css";

export function CapturedJeansContinuation() {
  return (
    <div
      className={`search-results ${styles.capturedContinuation}`}
      data-search-continuation="jeans"
      aria-label="More jeans results"
    >
      {capturedJeansContinuation.map((listing) => (
        <CapturedSearchResult key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

function CapturedSearchResult({ listing }: { listing: CapturedSearchListing }) {
  const state = useDiscovery();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const saved = state.saved.includes(listing.id);
  const openDetails = () => setDetailsOpen(true);
  return (
    <>
      <article
        className={`result-row ${styles.capturedResult}`}
        data-result-id={listing.id}
        data-source-frame={listing.sourceFrame}
      >
        <div className="product-media">
          <button
            type="button"
            className={styles.capturedResultMedia}
            aria-label={`View captured ${listing.title}`}
            onClick={openDetails}
          >
            <img src={listing.images[0]} alt={listing.title} />
          </button>
          <IconButton
            className="save-button"
            icon="heart"
            label={`${saved ? "Unsave" : "Save"} ${listing.title}`}
            pressed={saved}
            onClick={() => state.toggleSaved(listing.id)}
          />
        </div>
        <div>
          <button
            type="button"
            className={styles.capturedResultTitle}
            onClick={openDetails}
          >
            <strong>{listing.title}</strong>
          </button>
          <p className="rating">
            <span aria-label={`${listing.rating} out of 5 stars`}>
              {"\u2605\u2605\u2605\u2605\u2605"}
            </span>{" "}
            ({listing.ratingCount})
          </p>
          <p>{formatMoney(listing.price)}</p>
          <div className={styles.resultMerchant}>
            {listing.sellerHref ? (
              <Link className="result-store" href={listing.sellerHref}>
                <img src={listing.sellerLogo} alt="" />
                {listing.sellerName}
              </Link>
            ) : (
              <button
                type="button"
                className={`result-store ${styles.capturedSeller}`}
                aria-label={`View captured seller ${listing.sellerName}`}
                onClick={openDetails}
              >
                <img
                  className={styles.mmmlLogo}
                  src={listing.sellerLogo}
                  alt=""
                />
                {listing.sellerName}
              </button>
            )}
            {listing.sellerRating !== undefined && (
              <span>
                {listing.sellerRating} {"\u2605"}{" "}
                <span className={styles.muted}>
                  ({listing.sellerRatingCount})
                </span>
              </span>
            )}
            {listing.promotion && (
              <span className={styles.resultDeal}>{listing.promotion}</span>
            )}
          </div>
        </div>
      </article>
      <Sheet
        open={detailsOpen}
        title="Captured result details"
        onClose={() => setDetailsOpen(false)}
      >
        <p className="sheet-copy">{listing.detailUnavailable}</p>
        <button
          type="button"
          className="primary form-submit"
          onClick={() => setDetailsOpen(false)}
        >
          Back to search
        </button>
      </Sheet>
    </>
  );
}
