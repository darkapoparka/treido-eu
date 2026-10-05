import { expect, test } from "@playwright/test";

const headers = {
  Cookie: "shop-reference-scenario=reference-default; treido-locale=en",
  "Accept-Language": "bg-BG",
};

test("production language links redirect only to real account preferences", async ({
  request,
}) => {
  for (const [route, locale] of [
    ["/account/language?lang=bg", "bg"],
    ["/account/language?lang=en&returnTo=/search", "en"],
  ]) {
    const response = await request.get(route, { headers, maxRedirects: 0 });
    expect(response.status(), route).toBe(307);
    const location = response.headers().location;
    expect(location, route).toBe("/account/privacy/preferences?lang=" + locale);
    const html = await response.text();
    expect(html, route).not.toContain('id="preferred-language"');
    expect(html, route).not.toContain("mira@example.test");
  }
});

test("reference cookies and locale choices cannot replace the real marketplace", async ({
  request,
}) => {
  const response = await request.get("/search?lang=bg&seller=business", {
    headers,
  });
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain("data-marketplace");
  expect(html).toContain("Обявите временно не са достъпни");
  expect(html).not.toContain('id="preferred-language"');
  expect(html).not.toContain("mira@example.test");
  expect(html).not.toContain("/products/shea-butter");
});
