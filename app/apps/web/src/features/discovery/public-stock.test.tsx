import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PublicStockLabel, unavailablePublicStock } from "./public-stock";
import { PublicListingImage } from "./public-image";
const state = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next-intl", () => ({
  useLocale: () => state.locale,
  useTranslations: () => (key: string) => key,
}));
it.each(["reserved", "out_of_stock"] as const)("shows authoritative %s in media and result copy", (stock) => {
  expect(unavailablePublicStock(stock)).toBe(true);
  for (const media of [false, true]) {
    const html = renderToStaticMarkup(<PublicStockLabel state={stock} media={media} />);
    expect(html).toContain('data-public-stock="' + stock + '"');
    expect(html).toContain(stock);
  }
});
it.each([undefined, "unknown", "available"] as const)("does not invent a label for %s", (stock) => {
  expect(unavailablePublicStock(stock)).toBe(false);
  expect(renderToStaticMarkup(<PublicStockLabel state={stock} />)).toBe("");
});
it.each(["en", "bg"])("missing public media in %s does not request an empty or reference URL", (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(<PublicListingImage alt="Current listing" />);
  expect(html).toContain('role="img"');
  expect(html).toContain('data-public-image="unavailable"');
  expect(html).toContain(locale === "bg" ? "Снимката не е налична" : "Image unavailable");
  expect(html).toContain("Current listing");
  expect(html).not.toContain("<img");
  expect(html).not.toContain("reference");
});
it("healthy public media retains its actual source and single image element", () => {
  const html = renderToStaticMarkup(<PublicListingImage src="/api/listing-media/current/photo?v=2" alt="Current listing" />);
  expect(html.match(/<img\b/g)).toHaveLength(1);
  expect(html).toContain('src="/api/listing-media/current/photo?v=2"');
  expect(html).not.toContain("data-public-image");
  expect(html).not.toContain("srcSet");
});
