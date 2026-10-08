import { test, expect } from "@playwright/test";

test("production keeps reference pages and assets unavailable", async ({
  request,
}) => {
  for (const path of [
    "/products/shea-butter",
    "/products/not-a-reference-product",
    "/api/products/shea-butter/context?cart=rice-bundle&cover=rice-bundle",
    "/api/reference-media/cleo",
    "/api/reference-font",
    "/api/reference-font/regular",
    "/api/reference-video/kitsch-hero",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(await response.text(), path).not.toContain("mira@example.test");
  }
});

test("real profile and account entries stay honest when identity is unavailable", async ({
  request,
}) => {
  for (const path of ["/profile", "/account"]) {
    for (const locale of ["bg", "en"]) {
      const route = `${path}?lang=${locale}`;
      const response = await request.get(route, { maxRedirects: 0 });
      expect(response.status(), route).toBe(200);
      const html = await response.text();
      expect(html, route).toContain("buyer-public");
      expect(html, route).toContain(
        locale === "bg"
          ? "Профилът временно не е достъпен"
          : "Account temporarily unavailable",
      );
      expect(html, route).toContain("/account/privacy/preferences");
      expect(html, route).not.toContain("mira@example.test");
      expect(html, route).not.toContain('src="/api/reference-media/');
    }
  }
});

// CI deliberately has no provider/database secrets. Real routes must retain
// their honest unavailable state instead of loading the reference catalogue.
test("real marketplace and review routes stay available without reference data", async ({
  request,
}) => {
  for (const route of ["/?lang=en", "/search?lang=en"]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
    const html = await response.text();
    expect(html, route).toContain("buyer-public");
    expect(html, route).toContain("Listings are temporarily unavailable");
    expect(html, route).not.toContain("mira@example.test");
    expect(html, route).not.toContain("/products/shea-butter");
  }
  const response = await request.get("/checkout?lang=en");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain("Purchase reviews are temporarily unavailable.");
  expect(html).toContain("/checkout/reviews?lang=en");
  expect(html).not.toContain("mira@example.test");
  expect(html).not.toContain("/products/shea-butter");
});
