import { expect, test } from "@playwright/test";

for (const [id, count] of [
  ["cashmere", 8],
  ["airtag-wallet", 2],
  ["prismatic-gloss", 1],
] as const) {
  test(`native ${id} swatches decode all visible source photographs`, async ({
    context,
    page,
  }) => {
    await context.clearCookies();
    await page.setViewportSize({ width: 427, height: 876 });
    await page.goto(`/products/live-explore-${id}`);
    const swatches = page.locator(".native-color-grid > button > span");
    await expect(swatches).toHaveCount(count);
    const images = await swatches.evaluateAll(async (elements) => {
      const urls = elements.flatMap((element) =>
        [
          ...getComputedStyle(element).backgroundImage.matchAll(
            /url\(["']?(.*?)["']?\)/g,
          ),
        ].map((match) => match[1]),
      );
      return Promise.all(
        urls.map(async (url) => {
          const image = new Image();
          image.src = url;
          await image.decode();
          return {
            url,
            width: image.naturalWidth,
            height: image.naturalHeight,
          };
        }),
      );
    });
    // The native wallet uses two solid leather-color circles, not photographs.
    expect(images).toHaveLength(id === "airtag-wallet" ? 0 : count);
    if (id === "airtag-wallet") {
      const colors = await swatches.evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).backgroundColor),
      );
      expect(new Set(colors).size).toBe(2);
      expect(colors).not.toContain("rgba(0, 0, 0, 0)");
      await expect(
        page.getByRole("button", { name: "Color: Nappa Black", exact: true }),
      ).toBeEnabled();
      await expect(swatches.first()).toHaveAttribute(
        "data-unavailable",
        "true",
      );
      await expect(swatches.last()).toHaveAttribute("data-unavailable", "true");
    }
    for (const image of images) {
      expect(image.url).toContain("/api/reference-media/live-lower-");
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
    }
  });
}
