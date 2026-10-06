import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminHome } from "./admin-home";
import type { SellerContext } from "./persistence.server";

const sellerId = "10000000-0000-4000-8000-000000000001";
const seller: SellerContext = {
  sellerId,
  kind: "business",
  name: "Test workspace",
  revision: 1,
  capabilities: ["listing.read", "listing.write"],
};
const readOnlySeller: SellerContext = {
  ...seller,
  capabilities: ["listing.read"],
};
const scenarios = [
  { name: "no seller", seller: undefined, unavailable: false, path: "/sell" },
  {
    name: "unavailable without seller",
    seller: undefined,
    unavailable: true,
    path: "/sell",
  },
  { name: "unavailable with seller", seller, unavailable: true, path: "/sell" },
  {
    name: "writable seller",
    seller,
    unavailable: false,
    path: `/app/sellers/${sellerId}/listings/new`,
  },
  {
    name: "read-only seller",
    seller: readOnlySeller,
    unavailable: false,
    path: `/app/sellers/${sellerId}/listings`,
  },
] as const;

describe("workspace create navigation", () => {
  for (const language of ["bg", "en"] as const) {
    it.each(scenarios)(`preserves ${language} for $name`, (scenario) => {
      const markup = renderToStaticMarkup(
        createElement(AdminHome, {
          language,
          seller: scenario.seller,
          unavailable: scenario.unavailable,
        }),
      );
      const links = [
        ...markup.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
      ];
      const label = scenario.unavailable
        ? language === "bg"
          ? "Подготви артикул"
          : "Prepare an item"
        : language === "bg"
          ? "Добави продукт"
          : "Add product";
      const href = links.find(([, , text]) => text === label)?.[1];
      expect(href).toBe(`${scenario.path}?lang=${language}`);
    });
  }
});
