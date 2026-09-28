import { describe, expect, it } from "vitest";
import {
  normalizeReviewQuery,
  selectReviews,
  type ReviewSearchRecord,
} from "./review-model";

// Synthetic records only: these cases do not certify captured visual parity.
const records: readonly ReviewSearchRecord[] = [
  {
    id: "first",
    title: "A nice bar",
    body: "Fragrance free body soap",
    stars: 5,
    searchOrder: 2,
  },
  {
    id: "second",
    title: "",
    body: "Nice scent",
    stars: 4,
    variant: "NC / OS",
    searchOrder: 0,
    previewNewestOrder: 1,
  },
  {
    id: "search-only",
    title: "Extra",
    body: "Nice lather",
    stars: 3,
    searchOnly: true,
    searchOrder: 1,
    previewNewestOrder: 0,
  },
  {
    id: "tie",
    title: "",
    body: "Body soap",
    productTitle: "Coconut Shampoo",
    stars: 5,
    previewNewestOrder: 2,
  },
];
const ids = (items: readonly ReviewSearchRecord[]) =>
  items.map((item) => item.id);

describe("captured review selection", () => {
  it("normalizes case, full-width input and repeated whitespace", () => {
    expect(normalizeReviewQuery("  \uFF2E\uFF29\uFF23\uFF25 \n  BODY  ")).toBe(
      "nice body",
    );
  });

  it("keeps the captured default order and hides search-only extras", () => {
    expect(ids(selectReviews(records))).toEqual(["first", "second", "tie"]);
  });

  it("treats whitespace-only input as an empty query", () => {
    expect(selectReviews(records, { query: " \t \n " })).toEqual(
      selectReviews(records),
    );
  });

  it("uses the captured search order without changing individual ratings", () => {
    const result = selectReviews(records, { query: "  NICE " });
    expect(ids(result)).toEqual(["second", "search-only", "first"]);
    expect(result.map((record) => record.stars)).toEqual([4, 3, 5]);
  });

  it("matches all words across title and body", () => {
    expect(ids(selectReviews(records, { query: "body fragrance" }))).toEqual([
      "first",
    ]);
  });

  it("includes captured variant and product labels in matching", () => {
    expect(ids(selectReviews(records, { query: "nc os" }))).toEqual(["second"]);
    expect(ids(selectReviews(records, { query: "coconut shampoo" }))).toEqual([
      "tie",
    ]);
  });

  it("returns an actual empty result rather than substituting reviews", () => {
    expect(selectReviews(records, { query: "not-in-this-sample" })).toEqual([]);
    expect(selectReviews([])).toEqual([]);
  });

  it("sorts highest rating with stable source-order ties", () => {
    expect(ids(selectReviews(records, { sort: "Highest rating" }))).toEqual([
      "first",
      "tie",
      "second",
      "search-only",
    ]);
  });

  it("sorts lowest rating using the record rating rather than a label", () => {
    expect(ids(selectReviews(records, { sort: "Lowest rating" }))).toEqual([
      "search-only",
      "second",
      "first",
      "tie",
    ]);
  });

  it("filters by actual rating and exposes matching search-only records", () => {
    expect(ids(selectReviews(records, { rating: 3 }))).toEqual(["search-only"]);
    expect(ids(selectReviews(records, { rating: 4 }))).toEqual(["second"]);
    expect(selectReviews(records, { rating: 1 })).toEqual([]);
  });

  it("combines rating with the current query", () => {
    expect(ids(selectReviews(records, { query: "nice", rating: 5 }))).toEqual([
      "first",
    ]);
    expect(selectReviews(records, { query: "coconut", rating: 4 })).toEqual([]);
  });

  it("orders Most helpful by local selections without counting duplicates", () => {
    const options = {
      sort: "Most helpful" as const,
      helpful: ["second", "second", "unknown"],
    };
    expect(ids(selectReviews(records, options))).toEqual([
      "second",
      "first",
      "search-only",
      "tie",
    ]);
    expect(
      ids(selectReviews(records, { sort: "Most helpful", helpful: [] })),
    ).toEqual(["first", "second", "search-only", "tie"]);
  });

  it("uses known date ordering without inventing timestamps for unknown labels", () => {
    expect(ids(selectReviews(records, { sort: "Most recent" }))).toEqual([
      "search-only",
      "second",
      "tie",
      "first",
    ]);
    const unknown = records.map((record) => {
      const copy = { ...record };
      delete copy.previewNewestOrder;
      return copy;
    });
    expect(ids(selectReviews(unknown, { sort: "Most recent" }))).toEqual([
      "first",
      "second",
      "search-only",
      "tie",
    ]);
  });

  it("does not mutate source arrays, records or local helpful selections", () => {
    const frozen = Object.freeze(
      records.map((record) => Object.freeze({ ...record })),
    );
    const helpful = Object.freeze(["tie"]);
    const result = selectReviews(frozen, { sort: "Most helpful", helpful });
    expect(result[0]).toBe(frozen[3]);
    expect(ids(frozen)).toEqual(["first", "second", "search-only", "tie"]);
    expect(helpful).toEqual(["tie"]);
  });
});
