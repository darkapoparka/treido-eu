import { test, expect } from "@playwright/test";

test("production keeps reference pages and assets unavailable", async ({
  request,
}) => {
  for (const path of [
    "/",
    "/search",
    "/profile",
    "/checkout",
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
