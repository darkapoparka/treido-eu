import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    key + (values ? " " + Object.values(values).join(" ") : ""),
}));
vi.mock("../locale/use-caption", () => ({
  useCaption: () => (text: string) => text,
}));
vi.mock("./state", () => ({ useDiscovery: () => ({ visitMini: vi.fn() }) }));
vi.mock("../library/provider", () => ({
  LibraryProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./hydration-boundary", () => ({
  ShopSurface: ({ children, ...props }: { children: ReactNode }) =>
    createElement("main", props, children),
}));
vi.mock("./browse-scope", () => ({
  BrowseScopeControl: () => createElement("button", {}, "Seller scope"),
}));
vi.mock("./components", () => ({
  ProductCard: () => null,
  FloatingNav: ({ back }: { back: boolean }) =>
    createElement("nav", { "data-back": back }),
}));
vi.mock("./public-listing-grid", () => ({ PublicListingGrid: () => null }));
vi.mock("./return-navigation", () => ({
  useContextualClose: () => () => false,
  SourceLink: ({
    href,
    className,
    children,
    "aria-current": current,
  }: {
    href: string;
    className?: string;
    children: ReactNode;
    "aria-current"?: string;
  }) =>
    createElement("a", { href, className, "aria-current": current }, children),
}));

import { Explore } from "./explore";
import { PublicExplore } from "./public-explore";
import { PublicHomeContext } from "./public-home-context";
import { BuyerAvailability } from "./buyer-availability";
import { readDiscoveryInput } from "../catalog/discovery-input";

it("query and path category entries render the same title, category styling and Back control", () => {
  const publicView = {
    input: readDiscoveryInput({
      category: "cat:electronics",
      seller: "business",
      lang: "bg",
    }).input,
  };
  const query = renderToStaticMarkup(<Explore publicView={publicView} />);
  const path = renderToStaticMarkup(
    <Explore publicView={publicView} category="cat:electronics" />,
  );
  expect(query).toBe(path);
  expect(query).toContain('data-category="cat:electronics"');
  expect(query).toContain('data-back="true"');
  expect(query).toContain("Електроника");
});
it("category choices use one rail without a scope control, and All items opens scoped results", () => {
  const html = renderToStaticMarkup(
    <PublicExplore
      view={{
        input: readDiscoveryInput({
          category: "cat:electronics",
          seller: "personal",
          lang: "en",
          maxPrice: "300",
        }).input,
      }}
    />,
  );
  const rail = html
    .split('class="category-rail buyer-category-rail"')[1]
    .split("</div>")[0];
  expect(rail).not.toContain("allCategories");
  expect(rail).not.toContain("browseAndFilter");
  expect(rail).not.toContain("Seller scope");
  expect(rail).toContain("/search?category=cat%3Aelectronics&amp;");
  expect(rail).toContain("/explore/nav%3Aelectronics%2Fmobile");
  expect(rail).toContain("maxPrice=300.00");
  expect(html.match(/class="category-rail buyer-category-rail"/g)).toHaveLength(
    1,
  );
  expect(html).not.toContain("buyer-category-path");
  expect(html).not.toContain("buyer-explore-actions");
  expect(html).not.toContain("browseAndFilter");
});
it("a direct leaf exposes parent results and siblings in the same rail, with its current choice selected", () => {
  const html = renderToStaticMarkup(
    <PublicExplore
      view={{
        input: readDiscoveryInput({
          category: "cat:electronics/phones",
          lang: "en",
        }).input,
      }}
    />,
  );
  expect(html).toContain("/search?category=nav%3Aelectronics%2Fmobile&amp;");
  expect(html).not.toContain("buyer-category-path");
  expect(html).toMatch(
    /href="\/search\?category=cat%3Aelectronics%2Fphones[^"]*"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/search\?category=cat%3Aelectronics%2Fphones/,
  );
  expect(html).toContain("Tablets");
});
it("root Explore spends no chrome on seller scope or an empty pill rail", () => {
  const html = renderToStaticMarkup(
    <PublicExplore
      view={{ input: readDiscoveryInput({ lang: "bg" }).input }}
    />,
  );
  expect(html).not.toContain("Seller scope");
  expect(html).not.toContain('class="category-rail buyer-category-rail"');
  expect(html).not.toContain("browseAndFilter");
  expect(html).not.toContain("buyer-explore-actions");
});
it("filtered Home explains its category and clears criteria without clearing seller scope or language", () => {
  const html = renderToStaticMarkup(
    <PublicHomeContext
      input={
        readDiscoveryInput({
          category: "cat:art-handmade",
          seller: "business",
          lang: "en",
          q: "drawing",
          condition: "new",
        }).input
      }
    />,
  );
  expect(html).toContain("Art and handmade");
  expect(html).toContain('href="/?seller=business&amp;lang=en"');
  expect(html).toContain("browseAndFilter");
  expect(html).toContain("clear");
  expect(
    renderToStaticMarkup(
      <PublicHomeContext
        input={readDiscoveryInput({ seller: "personal" }).input}
      />,
    ),
  ).toBe("");
});
it("category emptiness remains distinct from a failed backend query", () => {
  expect(
    renderToStaticMarkup(<BuyerAvailability categoryLabel="Art" />),
  ).toContain("emptyCategory Art");
  const unavailable = renderToStaticMarkup(
    <BuyerAvailability unavailable categoryLabel="Art" />,
  );
  expect(unavailable).toContain("unavailable");
  expect(unavailable).not.toContain("emptyCategory");
});
