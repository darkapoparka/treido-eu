import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminHomeOperations } from "./admin-home-operations";
import { AdminAccountSwitcher } from "./admin-account-switcher";
import type { SellerOperationsView } from "./operations-model";
const sellerId = "10000000-0000-4000-8000-000000000001";
const view: SellerOperationsView = {
  sellerId,
  observedAt: "2026-10-11T00:00:00.000Z",
  counts: [
    { kind: "drafts", count: 3, hasMore: false },
    { kind: "photos", count: 1, hasMore: false },
    { kind: "stock", count: 2, hasMore: true },
  ],
  milestones: [],
};
describe("Studio presentation contracts", () => {
  for (const language of ["bg", "en"] as const) {
    it(`projects only returned operational data in ${language}`, () => {
      const html = renderToStaticMarkup(
        createElement(AdminHomeOperations, { view, language }),
      );
      expect(html).toContain(
        `/app/sellers/${sellerId}/listings?status=draft&amp;lang=${language}`,
      );
      expect(html).toContain(
        `/app/sellers/${sellerId}/inventory?lang=${language}`,
      );
      expect(html).not.toContain(`/app/sellers/${sellerId}/orders`);
      expect(html).toContain("2+");
      expect(html).toContain(
        language === "en"
          ? "Products with photo issues"
          : "Продукти с проблемни снимки",
      );
      expect(html).not.toMatch(/revenue|conversion|growth rate/i);
    });
    it(`keeps personal and business identity distinct in ${language}`, () => {
      const current = {
        sellerId,
        name: "Current seller",
        kind: "personal" as const,
      };
      const other = {
        sellerId: "10000000-0000-4000-8000-000000000002",
        name: "Business seller",
        kind: "business" as const,
      };
      const html = renderToStaticMarkup(
        createElement(AdminAccountSwitcher, {
          accounts: [current, other],
          current,
          language,
          onNavigate() {},
        }),
      );
      expect(html).toContain("Current seller");
      expect(html).toContain("Business seller");
      expect(html).toContain(
        language === "en" ? "Personal seller" : "Личен продавач",
      );
      expect(html).toContain(language === "en" ? "Business" : "Бизнес");
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
      expect(html).toContain(`/app/sellers/${sellerId}?lang=${language}`);
      expect(html).toContain(`/sell?lang=${language}`);
    });
  }
  it("does not fabricate zero counters for an unavailable dataset", () => {
    const html = renderToStaticMarkup(
      createElement(AdminHomeOperations, {
        view: { ...view, counts: [] },
        language: "en",
      }),
    );
    expect(html).toContain("not available with your access");
    expect(html).not.toContain("<strong>0</strong>");
  });
});
