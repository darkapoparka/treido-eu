import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("./hydration-boundary", () => ({
  ShopSurface: ({ children, ...props }: { children: ReactNode }) =>
    createElement("main", props, children),
}));
import styles from "./minis.module.css";
import {
  MiniCatalogHeading,
  MiniCatalogRowContent,
  MiniCatalogSurface,
} from "./minis-catalog";

it.each([false, true])(
  "shared catalogue preserves source surface/header/row DOM for android=%s",
  (android) => {
    const icon = <span data-source-icon />;
    const original = renderToStaticMarkup(
      <main
        className={`shop-page minis-page ${styles.catalog} ${android ? "android-live android-minis" : ""}`}
        data-searching={true}
      >
        <header className="section-heading">
          <h1>Minis</h1>
          <button>Search</button>
        </header>
        <div className="mini-list">
          <a href="/minis/sol">
            {icon}
            <span>
              <strong>Source Mini</strong>
              <p>Source description</p>
            </span>
          </a>
        </div>
      </main>,
    );
    const extracted = renderToStaticMarkup(
      <MiniCatalogSurface android={android} searching>
        <MiniCatalogHeading>
          <button>Search</button>
        </MiniCatalogHeading>
        <div className="mini-list">
          <a href="/minis/sol">
            <MiniCatalogRowContent
              icon={icon}
              name="Source Mini"
              description="Source description"
            />
          </a>
        </div>
      </MiniCatalogSurface>,
    );
    expect(extracted).toBe(original);
  },
);

it("public data selects the licensed buyer face without introducing another main or source media", () => {
  const html = renderToStaticMarkup(
    <MiniCatalogSurface android publicData>
      <MiniCatalogHeading>
        <button>Search</button>
      </MiniCatalogHeading>
    </MiniCatalogSurface>,
  );
  expect(html.match(/<main/g)).toHaveLength(1);
  expect(html).toContain(
    "android-live android-minis buyer-surface buyer-public",
  );
  expect(html).not.toContain("reference-media");
  expect(html).not.toContain("/api/reference-font");
});
