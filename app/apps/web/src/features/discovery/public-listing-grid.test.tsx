import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { PublicListingCard } from "../catalog/public-discovery-model";
import { PublicListingGrid } from "./public-listing-grid";
import { PublicHome } from "./public-home";

const navigation = vi.hoisted(() => ({
  locale: "bg" as "bg" | "en",
  params: new URLSearchParams(),
}));
vi.mock("next-intl", () => ({
  useLocale: () => navigation.locale,
  useTranslations: () => (key: string) => key,
}));
vi.mock("./state", () => ({ useDiscovery: () => ({ reportedProducts: [] }) }));
vi.mock("./use-sponsored-observation", () => ({
  useSponsoredObservation: () => ({ ref: undefined, onClick: undefined }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/products/current-item",
  useSearchParams: () => navigation.params,
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    onNavigate,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean; onNavigate?: unknown }) => {
    void prefetch;
    void onNavigate;
    return <a {...props} />;
  },
}));
vi.mock("../library/provider", () => ({
  useBuyerLibrary: () => ({ status: "guest", busy: false, execute: vi.fn() }),
}));

const listing: PublicListingCard = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Тестов телефон",
  images: ["/api/listing-media/test/photo?v=1"],
  price: { amount: 1250, currency: "EUR" },
  ratingCount: "",
  seller: { id: "seller", name: "Actual seller", kind: "personal" },
  categoryId: "cat:electronics/phones",
  condition: "good",
  locality: "София",
  publishedAt: "2026-10-06T00:00:00.000Z",
};

beforeEach(() => {
  navigation.locale = "bg";
  navigation.params = new URLSearchParams("lang=bg");
});

it.each([
  ["bg", "all"],
  ["bg", "personal"],
  ["bg", "business"],
  ["en", "all"],
  ["en", "personal"],
  ["en", "business"],
] as const)(
  "%s / %s lower related-item rail seller link keeps public criteria and its contextual return target",
  (locale, seller) => {
    navigation.locale = locale;
    navigation.params = new URLSearchParams({
      lang: locale,
      q: "phone",
      category: listing.categoryId,
      seller,
      condition: "good",
      minPrice: "12.50",
      maxPrice: "300",
      location: "София",
      sort: "price_desc",
      "attr.brand": "Apple",
      cursor: `payload.${"a".repeat(43)}`,
      sellerId: "private-operating-seller",
      role: "owner",
    });
    const html = renderToStaticMarkup(
      <PublicListingGrid items={[listing]} rail />,
    );
    expect(html).toContain('class="product-rail');
    const anchor = [...html.matchAll(/<a\b[^>]*>/g)]
      .map(([tag]) => tag)
      .find((tag) => tag.includes(`href="/stores/${listing.seller.id}?`));
    expect(anchor).toBeDefined();
    const href = anchor!.match(/\bhref="([^"]+)"/)![1].replaceAll("&amp;", "&");
    const destination = new URL(href, "https://treido.invalid");
    expect(destination.pathname).toBe(`/stores/${listing.seller.id}`);
    expect(Object.fromEntries(destination.searchParams)).toEqual({
      q: "phone",
      category: listing.categoryId,
      ...(seller === "all" ? {} : { seller }),
      condition: "good",
      location: "София",
      minPrice: "12.50",
      maxPrice: "300.00",
      currency: "EUR",
      sort: "price_desc",
      "attr.brand": "Apple",
      lang: locale,
    });
    const returnTarget = anchor!
      .match(/\bdata-source-return="([^"]+)"/)![1]
      .replaceAll("&amp;", "&");
    expect(returnTarget.startsWith(`${href}|`)).toBe(true);
    expect(returnTarget).not.toContain("private-operating-seller");
  },
);

it("compact sponsored shelves retain the actual price, sponsorship label and real save control", () => {
  const html = renderToStaticMarkup(
    <PublicListingGrid
      items={[listing]}
      rail
      compact
      placements={[
        {
          listing,
          sponsored: {
            campaignId: "campaign",
            token: "token",
            label: "Sponsored",
            labelBg: "Спонсорирано",
            promotedFreshnessAt: null,
          },
        },
      ]}
    />,
  );
  expect(html).toContain('class="product-card compact"');
  expect(html).toContain('class="price-badge "');
  expect(html).toContain("12,50");
  expect(html).toContain("Спонсорирано");
  expect(html).toContain('aria-label="save Тестов телефон"');
  expect(html).toContain("/products/" + listing.id);
  expect(html).not.toContain("София");
  expect(html).not.toContain("Actual seller");
});

it("ordinary personal grids retain readable title, price and seller/location facts", () => {
  const html = renderToStaticMarkup(<PublicListingGrid items={[listing]} />);
  expect(html).toContain('class="product-copy"');
  expect(html).toContain("Тестов телефон");
  expect(html).toContain("12,50");
  expect(html).toContain("София");
  expect(html).toContain("Actual seller");
  expect(html).toContain("personal");
  expect(html).not.toContain("price-badge");
});

it("both seller kinds stay in separate original Home containers with genuine links and compact supply", () => {
  const business = {
    ...listing,
    id: "business-item",
    seller: {
      id: "business-seller",
      name: "Actual business",
      kind: "business" as const,
    },
  };
  const html = renderToStaticMarkup(
    <PublicHome page={{ items: [listing, business] }} />,
  );
  expect(html.match(/class="android-merchant-card /g)).toHaveLength(2);
  expect(html).toContain('data-merchant-id="seller"');
  expect(html).toContain('data-merchant-id="business-seller"');
  expect(html).toContain('href="/stores/seller?lang=bg"');
  expect(html).toContain('href="/stores/business-seller?lang=bg"');
  expect(html.match(/class="product-card compact"/g)).toHaveLength(2);
  expect(html).not.toContain("public-home-personal");
  expect(html).not.toContain("product-grid");
  expect(html).not.toContain("★★★★★");
  expect(html).not.toContain("/api/reference-media");
});

it("real Explore/store shelf cards keep original rail/article DOM and actual seller/price/save without Marketplace facts", () => {
  const html = renderToStaticMarkup(
    <PublicListingGrid items={[listing]} rail shelf />,
  );
  expect(html).toMatch(
    /<div class="product-rail"><article class="product-card /,
  );
  expect(html).toContain("Actual seller");
  expect(html).toContain("12,50");
  expect(html).toContain('aria-label="save Тестов телефон"');
  expect(html).not.toContain("София");
  expect(html).not.toContain("/stores/seller");
});
