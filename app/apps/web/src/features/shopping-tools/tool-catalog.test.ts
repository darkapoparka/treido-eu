import { expect, it } from "vitest";
import { readDiscoveryInput } from "../catalog/discovery-input";
import {
  productMiniHref,
  productMinis,
  readProductMiniVisits,
  searchProductMinis,
} from "./tool-catalog";

it.each(["bg", "en"] as const)(
  "the %s catalogue contains the seven product tools and keeps Voice a Find mode",
  (locale) => {
    const tools = productMinis(locale);
    expect(tools.map((tool) => tool.id)).toEqual([
      "find-for-me",
      "deal-finder",
      "photo-match",
      "compare",
      "gift-finder",
      "compatibility",
      "sell-helper",
    ]);
    expect(
      tools.every((tool) => tool.name && tool.description && tool.group),
    ).toBe(true);
    expect(tools.map((tool) => tool.iconPosition)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
    expect(tools.filter((tool) => tool.hero).map((tool) => tool.id)).toEqual([
      "find-for-me",
      "gift-finder",
    ]);
    expect(
      tools
        .filter((tool) => tool.hero)
        .every((tool) =>
          /^\/minis\/treido-(find|gift)-banner\.png$/.test(tool.hero!),
        ),
    ).toBe(true);
    expect(
      tools.some((tool) =>
        tool.description
          .toLowerCase()
          .includes(locale === "en" ? "voice" : "глас"),
      ),
    ).toBe(true);
    expect(
      productMiniHref("find-for-me/voice", locale, new URLSearchParams()),
    ).toBe(`/minis/find-for-me/voice?lang=${locale}`);
  },
);

it.each(["bg", "en"] as const)(
  "inline %s search shows genuine recents and filters actual tools only",
  (locale) => {
    expect(searchProductMinis(locale, "", []).map((tool) => tool.id)).toEqual(
      [],
    );
    expect(
      searchProductMinis(locale, "  ", [
        "gift-finder",
        "skin",
        "find-for-me",
        "gift-finder",
      ]).map((tool) => tool.id),
    ).toEqual(["gift-finder", "find-for-me"]);
    expect(
      searchProductMinis(locale, locale === "en" ? "gift" : "подар", []).map(
        (tool) => tool.id,
      ),
    ).toEqual(["gift-finder"]);
    expect(
      searchProductMinis(locale, locale === "en" ? "voice" : "глас", []).map(
        (tool) => tool.id,
      ),
    ).toEqual(["find-for-me"]);
    expect(searchProductMinis(locale, "captured skincare", [])).toEqual([]);
  },
);

it.each(["bg", "en"] as const)(
  "real %s tool links preserve hard public criteria and retire private/captured/pagination inputs",
  (locale) => {
    const source = new URLSearchParams({
      q: "phone",
      category: "cat:electronics/phones",
      seller: "business",
      condition: "good",
      minPrice: "12.50",
      maxPrice: "300",
      location: "София",
      sort: "price_desc",
      lang: locale,
      "attr.brand": "Apple",
      cursor: `signed-page.${"a".repeat(43)}`,
      sellerId: "foreign-business",
      answer: "jeans",
      search: "1",
      miniSearch: "1",
      miniQuery: locale === "en" ? "gift" : "подарък",
    });
    for (const tool of productMinis(locale)) {
      const destination = new URL(
        productMiniHref(tool.id, locale, source),
        "https://treido.invalid",
      );
      expect(destination.pathname).toBe("/minis/" + tool.id);
      expect(readDiscoveryInput(destination.searchParams).input).toEqual(
        readDiscoveryInput(source).input,
      );
      for (const key of [
        "cursor",
        "sellerId",
        "answer",
        "search",
        "miniSearch",
        "miniQuery",
      ])
        expect(destination.searchParams.has(key)).toBe(false);
    }
  },
);

it("tab visits retain real known tools only, without captured or arbitrary browser content", () => {
  expect(
    readProductMiniVisits(
      JSON.stringify([
        "gift-finder",
        "gift-finder",
        "skin",
        "sol",
        "find-for-me",
        "find-for-me/voice",
        { id: "compare" },
        null,
        "compatibility",
        "sell-helper",
        "deal-finder",
        "photo-match",
        "compare",
      ]),
    ),
  ).toEqual([
    "gift-finder",
    "find-for-me",
    "compatibility",
    "sell-helper",
    "deal-finder",
    "photo-match",
    "compare",
  ]);
  expect(readProductMiniVisits(null)).toEqual([]);
  expect(readProductMiniVisits("not JSON")).toEqual([]);
  expect(readProductMiniVisits('{"id":"compare"}')).toEqual([]);
  expect(readProductMiniVisits(" ".repeat(2049))).toEqual([]);
  expect(
    readProductMiniVisits(
      JSON.stringify(Array(65).fill("unknown").concat("compare")),
    ),
  ).toEqual([]);
});
