"use client";
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Sheet, commitSheetQuery } from "./components";
import { useSheetStages } from "./sheet-stages";
import { NativeIcon } from "./native-icons";
import type { ReviewSort, ReviewRating } from "./review-model";
export const merchantReviewSorts: ReviewSort[] = [
  "Most relevant",
  "Most recent",
  "Highest rating",
  "Lowest rating",
];
export function readMerchantRatings(value: string | null): ReviewRating[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map(Number)
        .filter(
          (n): n is ReviewRating => Number.isInteger(n) && n >= 1 && n <= 5,
        ),
    ),
  ].sort((a, b) => b - a);
}
type Stage = "Filter" | "Sort by" | "Rating";
export function MerchantReviewFilters({
  sort,
  ratings,
}: {
  sort: ReviewSort;
  ratings: readonly ReviewRating[];
}) {
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  const [panel, setPanel] = useState<Stage | null>(null),
    [draftSort, setDraftSort] = useState(sort),
    [draftRatings, setDraftRatings] = useState<ReviewRating[]>([...ratings]);
  const retiring = useRef(false);
  const flow = useSheetStages<Stage>({
    open: panel !== null,
    initial: panel ?? "Filter",
    onClose: () => setPanel(null),
    onReopen: () => {
      retiring.current = false;
      setPanel("Filter");
    },
    onStart: () => {},
  });
  function open(stage: Stage) {
    if (flow.active) {
      flow.navigate(stage);
      return;
    }
    setDraftSort(sort);
    setDraftRatings([...ratings]);
    retiring.current = false;
    setPanel(stage);
  }
  function done() {
    if (retiring.current) return;
    retiring.current = true;
    const pathname = location.pathname;
    flow.close(() => {
      if (location.pathname !== pathname) return;
      const params = new URLSearchParams(location.search);
      if (draftSort === "Most relevant") params.delete("sort");
      else params.set("sort", draftSort);
      if (draftRatings.length)
        params.set("rating", [...draftRatings].sort((a, b) => b - a).join(","));
      else params.delete("rating");
      commitSheetQuery(params);
    });
  }
  const stage = flow.stage;
  return (
    <>
      <nav
        className="native-merchant-review-filters"
        aria-label={ui("reviewFilters")}
        data-ui-label="reviewFilters"
      >
        <button
          className="icon-button"
          aria-label={ui("filterReviews")}
          onClick={() => open("Filter")}
          data-ui-label="filterReviews"
        >
          <NativeIcon name="filter-circles" />
        </button>
        <button className="pill" onClick={() => open("Sort by")}>
          {ui("sortBy")}
          <NativeIcon name="chevron" />
        </button>
        <button className="pill" onClick={() => open("Rating")}>
          {ratings.length ? `Rating (${ratings.length})` : ui("rating")}
          <NativeIcon name="chevron" />
        </button>
      </nav>
      <Sheet
        open={flow.active}
        title={caption(stage)}
        manageHistory={false}
        onClose={() => flow.close()}
        className="native-merchant-review-filter-sheet"
      >
        {stage === "Filter" ? (
          <div className="native-merchant-choice-list">
            <button onClick={() => open("Sort by")}>
              {ui("sortBy")}
              <span>{caption(draftSort)}</span>
              <NativeIcon name="chevron" />
            </button>
            <button onClick={() => open("Rating")}>
              {ui("rating")}
              <span>
                {draftRatings.length
                  ? draftRatings.join(", ")
                  : ui("allRatings")}
              </span>
              <NativeIcon name="chevron" />
            </button>
          </div>
        ) : stage === "Sort by" ? (
          <div className="native-merchant-choice-list">
            {merchantReviewSorts.map((value) => (
              <button
                key={value}
                aria-pressed={draftSort === value}
                onClick={() => setDraftSort(value)}
              >
                {caption(value)}
                <span
                  className="merchant-review-radio"
                  data-selected={draftSort === value}
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="native-merchant-choice-list">
            {([5, 4, 3, 2, 1] as ReviewRating[]).map((value) => (
              <button
                key={value}
                aria-label={ui("value1Stars", { value1: value ?? "" })}
                aria-pressed={draftRatings.includes(value)}
                onClick={() =>
                  setDraftRatings((items) =>
                    items.includes(value)
                      ? items.filter((n) => n !== value)
                      : [...items, value],
                  )
                }
              >
                {caption(value)} ★
                <span
                  className="merchant-review-checkbox"
                  data-selected={draftRatings.includes(value)}
                >
                  {draftRatings.includes(value) && <NativeIcon name="check" />}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="native-merchant-filter-actions">
          <button
            className="pill"
            disabled={
              stage === "Rating"
                ? !draftRatings.length
                : stage === "Sort by"
                  ? draftSort === "Most relevant"
                  : draftSort === "Most relevant" && !draftRatings.length
            }
            onClick={() => {
              if (stage !== "Rating") setDraftSort("Most relevant");
              if (stage !== "Sort by") setDraftRatings([]);
            }}
          >
            {ui("reset")}
          </button>
          <button className="primary" onClick={done}>
            {ui("done")}
          </button>
        </div>
      </Sheet>
    </>
  );
}
