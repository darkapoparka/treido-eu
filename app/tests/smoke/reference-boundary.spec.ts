import { test, expect } from "@playwright/test";

test("reference pages and media are unavailable without preview opt-in", async ({
  request,
}) => {
  for (const path of [
    "/",
    "/search",
    "/profile",
    "/checkout",
    "/api/reference-media/cleo",
    "/api/reference-video/kitsch-hero",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(await response.text(), path).not.toContain("mira@example.test");
  }
});
