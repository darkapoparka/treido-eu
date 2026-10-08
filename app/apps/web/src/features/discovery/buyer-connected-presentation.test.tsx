import { expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("./hydration-boundary", () => ({
  ShopSurface: ({ children, ...props }: { children: ReactNode }) =>
    createElement("main", props, children),
}));
vi.mock("./return-navigation", () => ({
  SourceLink: ({
    children,
    sourceKey: _key,
    ...props
  }: {
    children: ReactNode;
    sourceKey?: string;
  }) => {
    void _key;
    return createElement("a", props, children);
  },
}));
vi.mock("./components", () => ({
  FloatingNav: () => createElement("nav", { "data-dock": true }),
}));
vi.mock("../account/forms", () => ({
  AccountPage: ({
    children,
    className,
    title,
  }: {
    children: ReactNode;
    className: string;
    title: string;
  }) =>
    createElement(
      "main",
      { className },
      createElement("h1", {}, title),
      children,
    ),
}));
vi.mock("../buyer-cart/mutation-button", () => ({
  CartMutationButton: ({
    operation,
    children,
    label,
    disabled,
  }: {
    operation: unknown;
    children: ReactNode;
    label: string;
    disabled: boolean;
  }) =>
    createElement(
      "button",
      {
        "data-command": JSON.stringify(operation),
        disabled,
        "aria-label": label,
      },
      children ?? label,
    ),
}));
import { BuyerFollowing } from "./following";
import { BuyerOrders } from "../commerce/orders";
import { BuyerCartLine } from "../buyer-cart/page";

it("real following uses the original management rows and real identity without reference posts", () => {
  const html = renderToStaticMarkup(
    <BuyerFollowing
      follows={[
        {
          id: "seller-id",
          seller: {
            id: "seller-id",
            name: "Actual seller",
            kind: "personal",
            description: "",
            locality: "",
            country: "BG",
          },
        },
      ]}
      ready
      state={null}
      control={(id) => <button data-follow-id={id}>Following</button>}
    />,
  );
  expect(html).toContain("following-management-row");
  expect(html).toContain("Actual seller");
  expect(html).toContain("/stores/seller-id?lang=en");
  expect(html).not.toContain("following-post");
  expect(html).not.toContain("reference-media");
});
it("real orders reuse source cards while retaining reported fulfilment as a distinct fact", () => {
  const html = renderToStaticMarkup(
    <BuyerOrders
      language="en"
      orders={[
        {
          id: "actual-order",
          sellerName: "Actual seller",
          totalMinor: 12345,
          currency: "EUR",
          payment: "Payment: Paid",
          fulfilment: "Fulfilment: Seller reported dispatch",
          settlement: "Seller transfer: Needs reconciliation",
          titles: ["Actual item"],
        },
      ]}
    />,
  );
  expect(html).toContain("account-panel tracking-card");
  expect(html).toContain("Seller reported dispatch");
  expect(html).toContain("Needs reconciliation");
  expect(html).toContain("/orders/actual-order?lang=en");
  expect(html).not.toContain("Delivered");
  expect(html).not.toContain("reference-media");
  expect(html).not.toContain("REF-");
});
it("cart quantity stepper sends genuine SKU and revision through existing commands", () => {
  const html = renderToStaticMarkup(
    <BuyerCartLine
      base={{ actorKey: "a".repeat(64), revision: 9, subject: "actual-user" }}
      line={{
        skuId: "actual-sku",
        quantity: 1,
        state: "ready",
        item: {
          listingId: "actual-listing",
          skuId: "actual-sku",
          sellerId: "actual-seller",
          sellerName: "Actual seller",
          title: "Actual item",
          photo: "",
          options: {},
          mode: "unique",
          publicationRevision: 4,
          priceMinor: 100,
          available: 1,
        },
      }}
    />,
  );
  expect(html).toContain("cart-stepper");
  expect(html).toContain("&quot;kind&quot;:&quot;remove&quot;");
  expect(html).toContain("&quot;skuId&quot;:&quot;actual-sku&quot;");
  expect(html).toContain("&quot;publicationRevision&quot;:4");
  expect(html).toContain("disabled");
  expect(html).not.toContain('type="number"');
});
it("a cart shortage retains an explicit remove command even above current stock", () => {
  const html = renderToStaticMarkup(
    <BuyerCartLine
      base={{ actorKey: "a".repeat(64), revision: 9, subject: "actual-user" }}
      line={{
        skuId: "actual-sku",
        quantity: 5,
        state: "shortage",
        item: {
          listingId: "actual-listing",
          skuId: "actual-sku",
          sellerId: "actual-seller",
          sellerName: "Actual seller",
          title: "Actual item",
          photo: "",
          options: {},
          mode: "stocked",
          publicationRevision: 4,
          priceMinor: 100,
          available: 2,
        },
      }}
    />,
  );
  expect(html).toContain('aria-label="remove"');
  expect(html).toContain("&quot;kind&quot;:&quot;remove&quot;");
  expect(html).toContain("&quot;skuId&quot;:&quot;actual-sku&quot;");
  expect(html).toContain("cart-stepper");
  expect(html).toContain("disabled");
});
