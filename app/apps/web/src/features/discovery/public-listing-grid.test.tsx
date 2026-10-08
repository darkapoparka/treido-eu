import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { PublicListingCard } from "../catalog/public-discovery-model";
import { PublicListingGrid } from "./public-listing-grid";
import { PublicHome } from "./public-home";

vi.mock("next-intl", () => ({
  useLocale: () => "bg",
  useTranslations: () => (key: string) => key,
}));
vi.mock("./state", () => ({ useDiscovery: () => ({ reportedProducts: [] }) }));
vi.mock("./use-sponsored-observation", () => ({
  useSponsoredObservation: () => ({ ref: undefined, onClick: undefined }),
}));
vi.mock("./return-navigation", () => ({
  SourceLink: ({
    href,
    children,
    className,
  }: {
    href: string;
    children?: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
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
