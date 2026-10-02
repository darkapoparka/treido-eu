"use client";
/* eslint-disable @next/next/no-img-element -- Frozen source photography. */
import { displayCount } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
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
  const ui = useTranslations("discoveryUI");
  return (
    <div
      className={`search-results ${styles.capturedContinuation}`}
      data-search-continuation="jeans"
      aria-label={ui("moreJeansResults")}
      data-ui-label="moreJeansResults"
    >
      {capturedJeansContinuation.map((listing) => (
        <CapturedSearchResult key={listing.id} listing={listing} />
      ))}
    </div>
  );
}

function CapturedSearchResult({ listing }: { listing: CapturedSearchListing }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
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
            aria-label={ui("viewCapturedValue1", {
              value1: listing.title ?? "",
            })}
            onClick={openDetails}
          >
            <img src={listing.images[0]} alt={listing.title} />
          </button>
          <IconButton
            className="save-button"
            icon="heart"
            label={`${saved ? ui("unsave") : ui("save")} ${listing.title}`}
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
            <span
              aria-label={ui("value1OutOf5Stars", {
                value1: listing.rating ?? "",
              })}
            >
              {"\u2605\u2605\u2605\u2605\u2605"}
            </span>{" "}
            ({displayCount(listing.ratingCount, intlLocale)})
          </p>
          <p>{formatMoney(listing.price, intlLocale)}</p>
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
                aria-label={ui("viewCapturedSellerValue1", {
                  value1: listing.sellerName ?? "",
                })}
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
        title={ui("capturedResultDetails")}
        onClose={() => setDetailsOpen(false)}
      >
        <p className="sheet-copy">{listing.detailUnavailable}</p>
        <button
          type="button"
          className="primary form-submit"
          onClick={() => setDetailsOpen(false)}
        >
          {ui("backToSearch")}
        </button>
      </Sheet>
    </>
  );
}
