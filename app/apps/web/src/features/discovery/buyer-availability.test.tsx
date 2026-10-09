import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getBrowseCategory } from "@treido/contracts/categories";
import { readDiscoveryInput } from "../catalog/discovery-input";
import { messages as localeMessages } from "../locale/messages";

const boundary = vi.hoisted(() => ({ locale: "en" as "bg" | "en" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: "marketplace" | "scope") =>
    (key: string, values?: Record<string, string>) => {
      const messages = localeMessages[boundary.locale][namespace];
      const message = messages[key as keyof typeof messages];
      if (typeof message !== "string") throw new Error("Unknown message");
      return message.replace(
        /\{(\w+)\}/g,
        (_, name: string) => values?.[name] ?? "",
      );
    },
}));
vi.mock("./return-navigation", () => ({
  SourceLink: ({
    children,
    preserveDiscoveryContext,
    startAtTop,
    ...props
  }: {
    children: ReactNode;
    preserveDiscoveryContext: boolean;
    startAtTop: boolean;
  }) =>
    createElement(
      "a",
      {
        ...props,
        "data-preserve-context": preserveDiscoveryContext,
        "data-start-at-top": startAtTop,
      },
      children,
    ),
}));
vi.mock("../library/controls", () => ({ ListingSaveButton: () => null }));
vi.mock("./use-sponsored-observation", () => ({
  useSponsoredObservation: () => ({ ref: undefined, onClick: undefined }),
}));

import { BuyerAvailability } from "./buyer-availability";
import { PublicSearchResults } from "./public-search-results";

beforeEach(() => {
  boundary.locale = "en";
});

it.each(["bg", "en"] as const)(
  "empty %s category results name the category and reset only public seller scope",
  (locale) => {
    boundary.locale = locale;
    const input = readDiscoveryInput({
      category: "cat:electronics/phones",
      q: "phone",
      seller: "business",
      condition: "good",
      minPrice: "12.50",
      maxPrice: "300",
      location: "София",
      sort: "price_desc",
      lang: locale,
      "attr.brand": "Apple",
      sellerId: "foreign-operating-seller",
    }).input;
    const html = renderToStaticMarkup(
      <PublicSearchResults
        page={{
          input,
          items: [],
          total: 0,
          facets: { categories: [], conditions: [], sellers: [] },
          nextCursor: `signed-page.${"a".repeat(43)}`,
          cursorReset: false,
        }}
      />,
    );
    expect(html).toContain(
      getBrowseCategory("cat:electronics/phones")?.labels[locale] ??
        "MISSING_CATEGORY",
    );
    expect(html).toContain(localeMessages[locale].scope.reset);
    const href = html.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(href).toBeDefined();
    const destination = new URL(href ?? "", "https://treido.invalid");
    expect(destination.pathname).toBe("/explore/cat%3Aelectronics%2Fphones");
    expect(readDiscoveryInput(destination.searchParams).input).toEqual({
      ...input,
      seller: "all",
    });
    expect(destination.searchParams.has("cursor")).toBe(false);
    expect(destination.searchParams.has("sellerId")).toBe(false);
    expect(html).toContain('data-preserve-context="false"');
    expect(html).toContain('data-start-at-top="true"');
    expect(html).not.toContain("reference-media");
  },
);

it("empty scoped Home keeps its own route and criteria when browsing all sellers", () => {
  const input = readDiscoveryInput({
    q: "lamp",
    seller: "personal",
    lang: "en",
  }).input;
  const html = renderToStaticMarkup(<BuyerAvailability home input={input} />);
  const href = html.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  const destination = new URL(href ?? "", "https://treido.invalid");
  expect(destination.pathname).toBe("/");
  expect(readDiscoveryInput(destination.searchParams).input).toEqual({
    ...input,
    seller: "all",
  });
});

it.each(["bg", "en"] as const)(
  "unavailable %s reads retain retry without claiming empty supply or relaxing filters",
  (locale) => {
    boundary.locale = locale;
    const input = readDiscoveryInput({
      category: "cat:electronics/phones",
      seller: "business",
      lang: locale,
    }).input;
    const html = renderToStaticMarkup(
      <BuyerAvailability unavailable input={input} />,
    );
    expect(html).toContain(localeMessages[locale].marketplace.unavailableTitle);
    expect(html).toContain(localeMessages[locale].marketplace.retry);
    expect(html).not.toContain("href=");
    expect(html).not.toContain(localeMessages[locale].scope.reset);
    expect(html).not.toContain(localeMessages[locale].marketplace.emptyTitle);
  },
);

it("an empty all-seller view offers no redundant seller reset", () => {
  const input = readDiscoveryInput({ seller: "all" }).input;
  const html = renderToStaticMarkup(<BuyerAvailability input={input} />);
  expect(html).not.toContain("href=");
  expect(html).not.toContain(localeMessages.en.scope.reset);
});
