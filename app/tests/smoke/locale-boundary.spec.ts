import { expect, test } from "@playwright/test";

test("locale preferences cannot expose reference buyer routes in production", async ({
  request,
}) => {
  for (const route of [
    "/account/language?lang=bg",
    "/account/language?lang=en&returnTo=/search",
    "/search?lang=bg&seller=business",
  ]) {
    const response = await request.get(route, {
      headers: {
        Cookie: "shop-reference-scenario=reference-default; treido-locale=en",
        "Accept-Language": "bg-BG",
      },
    });
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).not.toContain("data-browse-scope-trigger");
    expect(html).not.toContain('id="preferred-language"');
  }
});
