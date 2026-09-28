import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: false,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    baseURL: "http://127.0.0.1:3102",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "pnpm --filter @treido/web exec next start --hostname 127.0.0.1 --port 3102",
    port: 3102,
    env: { SHOP_REFERENCE_PREVIEW: "0" },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
