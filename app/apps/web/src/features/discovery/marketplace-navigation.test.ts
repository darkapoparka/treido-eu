import { expect, it } from "vitest";
import { readDiscoveryInput } from "../catalog/discovery-input";
import {
  marketplaceResultsHref,
  canonicalResultsDestination,
} from "./marketplace-navigation";

it.each([
  "cat:electronics",
  "nav:electronics/mobile",
  "cat:electronics/phones",
])(
  "category results have one canonical destination with complete criteria (%s)",
  (category) => {
    const input = readDiscoveryInput({
      category,
      q: "phone",
      seller: "business",
      condition: "good",
      minPrice: "12.50",
      location: "София",
      sort: "price_asc",
      lang: "en",
    }).input;
    const destination = new URL(
      marketplaceResultsHref(input, "signed-page"),
      "https://treido.invalid",
    );
    expect(destination.pathname).toBe(
      `/explore/${encodeURIComponent(category)}`,
    );
    expect(readDiscoveryInput(destination.searchParams).input).toEqual(input);
    expect(destination.searchParams.get("cursor")).toBe("signed-page");
    expect(destination.searchParams.get("lang")).toBe("en");
    expect(marketplaceResultsHref(input)).not.toContain("cursor=");
  },
);
it("removing category returns to global Search with the keyword and public scope", () => {
  const input = readDiscoveryInput({
    q: "phone",
    seller: "personal",
    lang: "bg",
  }).input;
  expect(marketplaceResultsHref(input)).toBe(
    "/search?q=phone&seller=personal&lang=bg",
  );
});
it("internal category aliases resolve before their SourceLink/dock return is recorded", () => {
  const href =
    "/search?q=phone&category=nav%3Aelectronics%2Fmobile&seller=personal&lang=bg&cursor=bounded-page#results";
  expect(canonicalResultsDestination(href)).toBe(
    "/explore/nav%3Aelectronics%2Fmobile?q=phone&category=nav%3Aelectronics%2Fmobile&seller=personal&lang=bg&cursor=bounded-page#results",
  );
});
it.each([
  "/search?q=phone&lang=en",
  "/search?category=Beauty&q=cream",
  "/search?category=cat%3Aunknown",
  "/search-other?category=cat%3Aelectronics",
  "https://external.invalid/search?category=cat%3Aelectronics",
])(
  "unscoped, reference, invalid and external links keep their destination (%s)",
  (href) => {
    expect(canonicalResultsDestination(href)).toBe(href);
  },
);
