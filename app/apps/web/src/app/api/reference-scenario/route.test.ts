import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GET } from "./route";
const base = "http://127.0.0.1:6418/api/reference-scenario";
beforeEach(() => {
  vi.stubEnv("SHOP_REFERENCE_PREVIEW", "1");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "development");
});
afterEach(() => vi.unstubAllEnvs());
it.each([
  ["SHOP_REFERENCE_PREVIEW", "0"],
  ["NODE_ENV", "production"],
  ["VERCEL", "1"],
  ["VERCEL_ENV", "production"],
])("denies %s before setting any QA cookie", async (key, value) => {
  vi.stubEnv(key, value);
  const response = await GET(new Request(base + "?action=public-data"));
  expect(response.status).toBe(404);
  expect(response.headers.has("set-cookie")).toBe(false);
  expect(response.headers.has("location")).toBe(false);
});
it.each([
  "https://127.0.0.1:6418/api/reference-scenario?action=public-data",
  "http://treido.eu/api/reference-scenario?action=public-data",
  base + "?action=public-data&target=https://example.com",
  base + "?action=public-data&target=//example.com",
  base + "?action=home-welcome",
  base + "?action=public-data&action=reset",
  base + "?action=public-data&lang=xx",
  base + "?action=public-data&next=/app",
])("rejects unqualified QA URL %s without cookie mutation", async (url) => {
  const response = await GET(new Request(url));
  expect(response.status).toBe(404);
  expect(response.headers.has("set-cookie")).toBe(false);
});
it.each(["host", "x-forwarded-host"])(
  "rejects non-loopback %s",
  async (key) => {
    const response = await GET(
      new Request(base + "?action=public-data", {
        headers: { [key]: "treido.eu" },
      }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.has("set-cookie")).toBe(false);
  },
);
it("sets only the existing QA cookie and redirects to same-origin Explore", async () => {
  const response = await GET(
    new Request(base + "?action=public-data&target=explore&lang=en", {
      headers: { host: "127.0.0.1:6418" },
    }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    "http://127.0.0.1:6418/explore?lang=en",
  );
  expect(response.headers.get("set-cookie")).toContain(
    "shop-reference-scenario=public-data;",
  );
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("resets the QA cookie and returns to reference Home without fixtures in the endpoint", async () => {
  const response = await GET(new Request(base + "?action=reset"));
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    "http://127.0.0.1:6418/?lang=bg",
  );
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
});
it("retains the caller host when Next normalizes the request URL to localhost", async () => {
  const response = await GET(
    new Request(
      "http://localhost:6418/api/reference-scenario?action=public-data&target=home&lang=bg",
      { headers: { host: "127.0.0.1:6418" } },
    ),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    "http://127.0.0.1:6418/?lang=bg",
  );
  expect(response.headers.get("set-cookie")).toContain(
    "shop-reference-scenario=public-data;",
  );
});
