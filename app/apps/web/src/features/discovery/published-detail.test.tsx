import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublishedProductDetail } from "./published-detail";
import { ProductSurface } from "./product-shell";
import { FloatingNav, StoreRow } from "./components";
import { ListingSaveButton } from "../library/controls";
import { PublicInventoryPanel } from "../inventory/public-panel";
import type { PublishedListing } from "../catalog/published-model";
import type { PublicInventory } from "../inventory/model";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import { readDiscoveryInput } from "../catalog/discovery-input";
import { messages } from "../locale/messages";

const navigation = vi.hoisted(() => ({
  locale: "bg" as "bg" | "en",
  params: new URLSearchParams(),
}));
const library = vi.hoisted(() => ({
  status: "guest",
  busy: false,
  view: { savedIds: [] as string[], followedIds: [] as string[] },
  execute: vi.fn(),
  openPicker: vi.fn(),
  query: {} as Record<string, unknown>,
}));
vi.mock("../library/provider", () => ({
  LibraryProvider: ({
    children,
    query,
  }: {
    children: ReactNode;
    query: Record<string, unknown>;
  }) => {
    library.query = query;
    return children;
  },
  useBuyerLibrary: () => library,
}));
vi.mock("next-intl", () => ({
  useLocale: () => navigation.locale,
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));
vi.mock("../locale/provider", () => ({
  useLocale: () => ({
    locale: navigation.locale,
    messages: messages[navigation.locale],
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/products/10000000-0000-4000-8000-000000000001",
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
vi.mock("./state", () => ({
  useDiscovery: () => ({ cart: [], viewedProducts: [] }),
}));
vi.mock("../inventory/actions", () => ({ readPublicInventoryAction: vi.fn() }));
vi.mock("../promotions/metric-actions", () => ({
  recordPromotionMetricAction: vi.fn(),
}));
vi.mock("../buyer-cart/mutation-button", () => ({
  CartMutationButton: () => <button data-cart-mutation>Cart mutation</button>,
}));

const listing: PublishedListing = {
  id: "10000000-0000-4000-8000-000000000001",
  revision: 2,
  publishedAt: "2026-10-06T10:00:00Z",
  seller: {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Real seller",
    kind: "business",
  },
  title: "Real item",
  description: "Actual seller description",
  categoryId: "cat:electronics/phones",
  condition: "good",
  fields: {},
  price: { amount: 12345, currency: "EUR" },
  locality: "София",
  country: "BG",
  handover: ["pickup"],
  deliveryDetails: "Actual pickup terms",
  defects: "Disclosed defect",
  photos: [
    { id: "photo", url: "/api/public-media/photo", width: 600, height: 600 },
  ],
  purchaseMode: "contact",
};
const product: ProductDetailProduct = {
  id: listing.id,
  title: listing.title,
  storeId: listing.seller.id,
  images: listing.photos.map((photo) => photo.url),
  price: listing.price,
  description: listing.description,
  variants: [],
  ratingCount: "",
};
const stocked: PublicInventory = {
  mode: "stocked",
  state: "available",
  publicationRevision: 2,
  skus: [
    { id: "sku", options: {}, priceMinor: 14000, available: 3, onHand: 3 },
  ],
};

beforeEach(() => {
  navigation.locale = "bg";
  navigation.params = new URLSearchParams("lang=bg&seller=business");
  library.execute.mockClear();
  library.status = "guest";
  library.busy = false;
  library.view.savedIds = [];
});

function publicContext(
  locale: "bg" | "en",
  seller: "all" | "personal" | "business",
  category = listing.categoryId,
) {
  navigation.locale = locale;
  navigation.params = new URLSearchParams({
    lang: locale,
    seller,
    q: "phone",
    category,
    condition: "good",
    minPrice: "12.50",
    maxPrice: "300",
    location: "София",
    sort: "price_desc",
    "attr.brand": "Apple",
    "attr.storageGB": "128",
    "attr.unsupported": "ignored",
    cursor: `payload.${"a".repeat(43)}`,
    sellerId: "private-operating-seller",
    feedbackPage: "9",
    miniSearch: "1",
    miniQuery: "Find",
  });
}

function contextualLink(html: string, path: string) {
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map(([anchor]) => {
    const href = anchor.match(/\bhref="([^"]+)"/)?.[1].replaceAll("&amp;", "&");
    const target = anchor
      .match(/\bdata-source-return="([^"]+)"/)?.[1]
      .replaceAll("&amp;", "&");
    return { href, target };
  });
  const link = links.find(
    ({ href }) =>
      href && new URL(href, "https://treido.invalid").pathname === path,
  );
  expect(link?.href).toBeDefined();
  const href = link!.href!;
  const destination = new URL(href, "https://treido.invalid");
  expect(link!.target?.startsWith(`${href}|`)).toBe(true);
  for (const key of [
    "cursor",
    "sellerId",
    "feedbackPage",
    "miniSearch",
    "miniQuery",
    "attr.unsupported",
  ])
    expect(destination.searchParams.has(key)).toBe(false);
  return destination;
}

describe("public product presentation boundaries", () => {
  it("selects the shared product shell without reference assets and keeps actual content/actions", () => {
    const html = renderToStaticMarkup(
      <PublishedProductDetail listing={listing} />,
    );
    expect(html).toContain("shop-product published-product");
    expect(html).not.toMatch(
      /android-live|api\/reference-|photo-3x|data-cart-mutation|href="\/cart/,
    );
    expect(html).toContain('src="/api/public-media/photo"');
    expect(html).toContain(listing.description);
    expect(html).toContain(listing.defects);
    expect(html).toContain(listing.deliveryDetails);
    expect(html).toContain("София");
    expect(html).toContain(`/messages/new?listing=${listing.id}&amp;lang=bg`);
    expect(html).toContain(
      `/stores/${listing.seller.id}?seller=business&amp;lang=bg`,
    );
    expect(html).toMatch(
      /product-heading[^]*<h1>Real item<\/h1>[^]*aria-label="library.save Real item"[^]*aria-label="publication.share"/,
    );
    expect(html.match(/<details\b/g)).toHaveLength(4);
    expect(library.query).toEqual({
      view: "state",
      listingIds: [listing.id],
      sellerIds: [listing.seller.id],
    });
  });

  it.each([
    ["bg", "all"],
    ["bg", "personal"],
    ["bg", "business"],
    ["en", "all"],
    ["en", "personal"],
    ["en", "business"],
  ] as const)(
    "%s / %s item continuations retain public criteria and their contextual return targets",
    (locale, seller) => {
      publicContext(locale, seller);
      const html = renderToStaticMarkup(
        <PublishedProductDetail listing={listing} />,
      );
      for (const path of [
        `/stores/${listing.seller.id}`,
        `/explore/${encodeURIComponent(listing.categoryId)}`,
      ]) {
        const destination = contextualLink(html, path);
        expect(destination.searchParams.get("lang")).toBe(locale);
        expect(readDiscoveryInput(destination.searchParams).input).toEqual({
          q: "phone",
          category: listing.categoryId,
          seller,
          condition: "good",
          location: "София",
          minPriceMinor: 1250,
          maxPriceMinor: 30000,
          currency: "EUR",
          sort: "price_desc",
          locale,
          attributes: { brand: "Apple", storageGB: 128 },
        });
      }
    },
  );

  it.each(["bg", "en"] as const)(
    "%s item category continuation replaces a different category and retires its attributes",
    (locale) => {
      publicContext(locale, "personal", "cat:electronics/laptops");
      const html = renderToStaticMarkup(
        <PublishedProductDetail listing={listing} />,
      );
      const destination = contextualLink(
        html,
        `/explore/${encodeURIComponent(listing.categoryId)}`,
      );
      expect(destination.searchParams.get("lang")).toBe(locale);
      expect(readDiscoveryInput(destination.searchParams).input).toEqual({
        q: "phone",
        category: listing.categoryId,
        seller: "personal",
        condition: "good",
        location: "София",
        minPriceMinor: 1250,
        maxPriceMinor: 30000,
        currency: "EUR",
        sort: "price_desc",
        locale,
        attributes: {},
      });
    },
  );

  it.each([
    stocked,
    {
      mode: "unknown",
      state: "unknown",
      publicationRevision: 2,
      skus: [],
    } as PublicInventory,
    null,
  ])(
    "contact-only detail keeps inventory status and never offers checkout (%j)",
    (inventory) => {
      const html = renderToStaticMarkup(
        <PublishedProductDetail listing={listing} inventory={inventory} />,
      );
      expect(html).toContain('data-public-inventory="true"');
      expect(html).toContain(
        inventory === null
          ? "inventory.unavailablePublic"
          : `inventory.${inventory.state}`,
      );
      expect(html).toContain("product-price");
      expect(html).not.toMatch(
        /data-cart-mutation|href="\/cart|buyerCart.add|inventory.quantity|inventory.stockNote/,
      );
      expect(html).toContain(`/messages/new?listing=${listing.id}`);
    },
  );

  it("retains existing inventory cart behavior when the optional flag is omitted", () => {
    const html = renderToStaticMarkup(
      <PublicInventoryPanel product={product} revision={2} initial={stocked} />,
    );
    expect(html).toContain("data-cart-mutation");
    expect(html).toContain("/cart?lang=bg");
    expect(html).toContain("inventory.quantity");
  });

  it.each(["bg", "en"] as const)(
    "%s qualified entry uses the real cart control and retains seller contact without promising payment",
    (locale) => {
      navigation.locale = locale;
      const html = renderToStaticMarkup(
        <PublishedProductDetail
          listing={listing}
          inventory={stocked}
          paymentEntryAvailable
        />,
      );
      expect(html).toContain("data-cart-mutation");
      expect(html).toContain(`/cart?lang=${locale}`);
      expect(html).toContain(`/messages/new?listing=${listing.id}`);
      expect(html).toContain("publication.buyerPaymentNote");
      expect(html).not.toContain("publication.buyerContactNote");
      expect(html).not.toContain("/checkout/payments/");
    },
  );

  it("uses the actual save command and known saved state; unavailable state stays disabled", async () => {
    const control = ListingSaveButton({
      id: listing.id,
      title: listing.title,
      overlay: false,
    });
    control.props.onClick();
    expect(library.execute).toHaveBeenCalledWith({
      kind: "save",
      listingId: listing.id,
      saved: true,
    });
    library.view.savedIds = [listing.id];
    expect(
      ListingSaveButton({ id: listing.id, title: listing.title }).props.pressed,
    ).toBe(true);
    library.status = "failed";
    expect(
      ListingSaveButton({ id: listing.id, title: listing.title }).props
        .disabled,
    ).toBe(true);
  });

  it("keeps default StoreRow identity and information action; public slots do not invent ratings", () => {
    const defaultRow = renderToStaticMarkup(
      <StoreRow store={{ id: "seller", name: "Seller" }} />,
    );
    expect(defaultRow).toContain("/stores/seller/info");
    expect(defaultRow).not.toContain("★");
    const publicRow = renderToStaticMarkup(
      <StoreRow
        store={{ id: "seller", name: "Seller" }}
        href="/stores/seller?lang=bg"
        subtitle={<small>business</small>}
        actions={<button>Follow</button>}
        preserveDiscoveryContext={false}
      />,
    );
    expect(publicRow).toContain('href="/stores/seller?lang=bg"');
    expect(publicRow).toContain("business");
    expect(publicRow).not.toContain("/stores/seller/info");
  });

  it("keeps the approved four destinations and measured icon owner across buyer dock consumers", () => {
    const defaultDock = renderToStaticMarkup(<FloatingNav />);
    expect(defaultDock).toContain("/explore");
    expect(defaultDock).toContain("/orders");
    expect(defaultDock).not.toContain("/messages");
    const publicDock = renderToStaticMarkup(
      <FloatingNav marketplace sourceNavigation />,
    );
    expect(publicDock).toBe(defaultDock);
    expect(publicDock).not.toContain("/messages");
    expect(publicDock).not.toContain("/app");
    expect(publicDock).toContain('data-nav-kind="chat"');
    expect(renderToStaticMarkup(<FloatingNav nativeIcons />)).toBe(defaultDock);
  });

  it("does not opt frozen non-Android reference products into the shared geometry", () => {
    expect(
      renderToStaticMarkup(
        <ProductSurface shopPresentation={false} className="product-page" />,
      ),
    ).not.toContain("shop-product");
  });
});
