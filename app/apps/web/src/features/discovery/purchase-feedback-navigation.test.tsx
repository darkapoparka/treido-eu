import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { readDiscoveryInput } from "../catalog/discovery-input";
import { messages as localeMessages } from "../locale/messages";

const boundary = vi.hoisted(() => ({
  locale: "en" as "bg" | "en",
  params: new URLSearchParams(),
  replace: vi.fn(),
  refresh: vi.fn(),
  retry: null as (() => void) | null,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => boundary.params,
  usePathname: () => "/stores/00000000-0000-4000-8000-000000000001/info",
  useRouter: () => ({ replace: boundary.replace, refresh: boundary.refresh }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    "data-source-return": returnTarget,
  }: {
    href: string;
    children: ReactNode;
    "data-source-return"?: string;
  }) =>
    createElement("a", { href, "data-source-return": returnTarget }, children),
}));
vi.mock("next-intl", () => ({
  useLocale: () => boundary.locale,
  useTranslations:
    (namespace: "discoveryUI" | "marketplace") =>
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
vi.mock("../library/provider", () => ({
  LibraryProvider: ({ children }: { children: ReactNode }) => children,
  useBuyerLibrary: () => ({ status: "guest", busy: false, view: null }),
}));
vi.mock("../library/controls", () => ({ ListingSaveButton: () => null }));
vi.mock("../seller-settings/public-info", () => ({
  PublicServiceInfo: () => null,
}));
vi.mock("./native-merchant-chrome", () => ({
  MerchantShell: ({ children }: { children: ReactNode }) =>
    createElement("main", null, children),
  MerchantHeader: () => null,
  MerchantIdentity: () => null,
  MerchantAvatar: () => null,
}));
vi.mock("./components", () => ({
  FloatingNav: () => null,
  IconButton: () => null,
  ProductCard: () => null,
  Sheet: () => null,
}));
vi.mock("./state", () => ({ useDiscovery: () => ({ viewStore: vi.fn() }) }));
vi.mock("./public-listing-grid", () => ({ PublicListingGrid: () => null }));
vi.mock("./public-search-filters", () => ({ PublicSearchFilters: () => null }));
vi.mock("./use-sponsored-observation", () => ({
  useSponsoredObservation: () => ({}),
}));
vi.mock("./purchase-feedback", async (original) => {
  const feedback = await original<typeof import("./purchase-feedback")>();
  return {
    ...feedback,
    PurchaseFeedback: (
      props: Parameters<typeof feedback.PurchaseFeedback>[0],
    ) => {
      boundary.retry = props.onRetry;
      return createElement(feedback.PurchaseFeedback, props);
    },
  };
});

import { PurchaseFeedback } from "./purchase-feedback";
import { PublicStore } from "./public-store";
import type { PublicStoreView } from "./public-store-model";

const sellerId = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  boundary.retry = null;
});
function context(locale: "bg" | "en") {
  boundary.locale = locale;
  boundary.params = new URLSearchParams({
    lang: locale,
    q: "phone",
    seller: "business",
    category: "cat:electronics/phones",
    condition: "good",
    minPrice: "12.50",
    maxPrice: "300",
    location: "София",
    sort: "price_desc",
    "attr.brand": "Apple",
    cursor: `payload.${"a".repeat(43)}`,
    sellerId: "private-operating-seller",
    feedbackPage: "2",
  });
}
function expectPublicContext(href: string) {
  const destination = new URL(href, "https://treido.invalid");
  expect(destination.pathname).toBe(`/stores/${sellerId}/info`);
  expect(readDiscoveryInput(destination.searchParams).input).toEqual(
    readDiscoveryInput(boundary.params).input,
  );
  expect(destination.searchParams.get("lang")).toBe(boundary.locale);
  expect(destination.searchParams.has("cursor")).toBe(false);
  expect(destination.searchParams.has("sellerId")).toBe(false);
  return destination;
}

it.each(["bg", "en"] as const)(
  "%s feedback pages preserve public criteria and record their exact contextual return targets",
  (locale) => {
    context(locale);
    const html = renderToStaticMarkup(
      <PurchaseFeedback
        data={{ available: true, items: [], more: true, page: 2 }}
        sellerId={sellerId}
        locale={locale}
        onRetry={() => {}}
      />,
    );
    const links = [
      ...html.matchAll(/<a href="([^"]+)" data-source-return="([^"]+)"/g),
    ];
    expect(links).toHaveLength(2);
    links.forEach((link, index) => {
      const href = link[1].replaceAll("&amp;", "&");
      expect(expectPublicContext(href).searchParams.get("feedbackPage")).toBe(
        index === 0 ? "1" : "3",
      );
      expect(link[2].replaceAll("&amp;", "&")).toBe(`${href}||`);
    });
  },
);

it.each(["bg", "en"] as const)(
  "%s genuine Store feedback retry retires the stale feedback page without dropping public criteria",
  (locale) => {
    context(locale);
    const input = readDiscoveryInput(boundary.params).input;
    const view: PublicStoreView = {
      input: { ...input, seller: "all" },
      seller: {
        id: sellerId,
        kind: "business",
        name: "Isolated navigation test seller",
        description: "",
        locality: "София",
        country: "BG",
      },
      purchaseFeedback: { available: false, items: [], more: false, page: 2 },
    };
    const html = renderToStaticMarkup(<PublicStore view={view} kind="info" />);
    expect(html).toContain(
      locale === "bg"
        ? "Отзивите за поръчки в момента не са достъпни."
        : "Order feedback is currently unavailable.",
    );
    expect(boundary.retry).not.toBeNull();
    boundary.retry!();
    expect(boundary.replace).toHaveBeenCalledTimes(1);
    expect(
      expectPublicContext(boundary.replace.mock.calls[0][0]).searchParams.has(
        "feedbackPage",
      ),
    ).toBe(false);
    expect(boundary.refresh).not.toHaveBeenCalled();

    boundary.params.delete("feedbackPage");
    renderToStaticMarkup(<PublicStore view={view} kind="info" />);
    boundary.retry!();
    expect(boundary.refresh).toHaveBeenCalledTimes(1);
    expect(boundary.replace).toHaveBeenCalledTimes(1);
  },
);
