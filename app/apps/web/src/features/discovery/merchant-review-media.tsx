"use client";
/* eslint-disable @next/next/no-img-element -- Private, native review image fields. */
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { IconButton, Sheet } from "./components";
import { ReviewStars, ReviewReport } from "./review-feedback";
import { useReviewFeedback } from "./review-state";
import type { MerchantReviewMediaItem } from "../catalog/merchant-types";
import "./merchant-review-media.css";

export function MerchantReviewMedia({
  items,
  selected,
  onSelect,
  onClose,
  kind = "merchant",
}: {
  kind?: "merchant" | "product";
  items: readonly MerchantReviewMediaItem[];
  selected: number | null;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const ui = useTranslations("discoveryUI");
  const [report, setReport] = useState(false);
  const feedback = useReviewFeedback(
    `merchant-media:${items[0]?.id ?? "empty"}`,
  );
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const reportId = useRef("");
  const current = selected === null ? undefined : items[selected];
  const choose = (index: number) =>
    onSelect(Math.max(0, Math.min(items.length - 1, index)));
  return (
    <>
      <Sheet
        open={!!current}
        onClose={onClose}
        title={ui("reviewPhoto")}
        headerless
        className={`native-merchant-media-fullscreen ${kind === "product" ? "native-product-media-fullscreen" : ""}`}
        initialFocus=".merchant-review-media-close"
      >
        <IconButton
          native
          icon="close"
          label={ui("closeReviewMedia")}
          className="merchant-review-media-close"
          onClick={onClose}
          data-ui-label="closeReviewMedia"
        />
        {current && (
          <>
            <div
              className="merchant-review-media-stage"
              tabIndex={0}
              role="group"
              aria-label={ui(
                "reviewPhotographValue1OfValue2UseArrowKeysToChange",
                {
                  value1: (selected ?? 0) + 1,
                  value2: items.length ?? "",
                },
              )}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  choose((selected ?? 0) + 1);
                }
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  choose((selected ?? 0) - 1);
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  choose(0);
                }
                if (e.key === "End") {
                  e.preventDefault();
                  choose(items.length - 1);
                }
              }}
              onPointerDown={(e) => {
                pointer.current = {
                  id: e.pointerId,
                  x: e.clientX,
                  y: e.clientY,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={(e) => {
                const start = pointer.current;
                pointer.current = null;
                if (!start || start.id !== e.pointerId) return;
                const dx = e.clientX - start.x,
                  dy = e.clientY - start.y;
                if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy))
                  choose((selected ?? 0) + (dx < 0 ? 1 : -1));
              }}
              onPointerCancel={() => {
                pointer.current = null;
              }}
            >
              <img
                src={current.image}
                alt={ui("reviewPhotographValue1", {
                  value1: (selected ?? 0) + 1,
                })}
                draggable={false}
              />
            </div>
            <div
              className="merchant-review-media-thumbnails"
              role="group"
              aria-label={ui("reviewPhotographs")}
              data-ui-label="reviewPhotographs"
            >
              {items.map((item, index) => (
                <button
                  key={item.id}
                  aria-label={ui("viewReviewPhotographValue1", {
                    value1: index + 1,
                  })}
                  aria-pressed={selected === index}
                  onClick={() => choose(index)}
                  ref={(element) => {
                    if (element && selected === index)
                      element.scrollIntoView({
                        block: "nearest",
                        inline: "nearest",
                      });
                  }}
                >
                  <img src={item.thumbnail} alt="" loading="lazy" />
                </button>
              ))}
            </div>
            <div className="merchant-review-media-caption">
              {(current.productTitle || current.title) && (
                <div className="merchant-review-media-product">
                  {current.productImage && (
                    <img src={current.productImage} alt="" />
                  )}
                  <div>
                    {current.stars !== undefined && (
                      <ReviewStars rating={current.stars} />
                    )}
                    {current.title && <h2>{current.title}</h2>}
                    <span>{current.productTitle}</span>
                  </div>
                </div>
              )}
              <p>{current.body}</p>
              <footer>
                {current.author && (
                  <>
                    <i aria-hidden="true">{current.author[0]}</i>
                    <small>
                      {current.author} · {current.date}
                    </small>
                  </>
                )}
                <IconButton
                  native
                  icon="more"
                  label={ui("moreActionsForThisPhotoReview")}
                  onClick={() => {
                    reportId.current = current.id;
                    setReport(true);
                  }}
                  data-ui-label="moreActionsForThisPhotoReview"
                />
              </footer>
            </div>
          </>
        )}
      </Sheet>
      <ReviewReport
        open={report}
        onClose={() => setReport(false)}
        onReopen={() => setReport(true)}
        onReport={(reason) => feedback.markReported(reportId.current, reason)}
      />
    </>
  );
}
