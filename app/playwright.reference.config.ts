import { defineConfig } from "@playwright/test";

// Reference data is development-only. Production gets separate fail-closed smoke
// checks, never fixture journeys through next start. Without an external preview,
// stop another runtime that owns this workspace's .next directory.
// A confirmed local preview can serve captures and journey tests without two
// Next processes writing .next. CI retains its existing owned-server default.
const externalPreview = process.env.REFERENCE_BASE_URL;
if (externalPreview) {
  const url = new URL(externalPreview);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.protocol !== "http:" ||
    url.username ||
    url.password ||
    url.port === "6412"
  )
    throw new Error("Reference journeys require the owned loopback preview");
}
// Media is deliberately acquired; it is never an implicit install-time download.
export default defineConfig({
  testDir: "./tests/reference",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: externalPreview || "http://127.0.0.1:3103",
    viewport: { width: 393, height: 793 },
    // Frozen journeys opt into their original synthetic baseline. Live-Android
    // journeys clear these cookies before entry; no identity leaks into guests.
    storageState: {
      cookies: [
        {
          name: "shop-reference-scenario",
          value: "reference-default",
          domain: new URL(externalPreview || "http://127.0.0.1:3103").hostname,
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: externalPreview
    ? undefined
    : {
        command:
          "pnpm --filter @treido/web exec next dev --hostname 127.0.0.1 --port 3103",
        url: "http://127.0.0.1:3103",
        env: {
          SHOP_REFERENCE_PREVIEW: "1",
          VERCEL_ENV: "preview",
          NODE_ENV: "development",
        },
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
