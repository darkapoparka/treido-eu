import { defineConfig } from "vitest/config";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
export default defineConfig({
  root,
  resolve: {
    alias: { "server-only": path.join(root, "tests/t61/server-only.mjs") },
  },
  test: {
    include: [
      "tests/t72/billing*.test.ts",
      "apps/web/src/features/seller-billing/model.test.ts",
      "apps/web/src/features/seller-billing/payment-evidence.test.ts",
    ],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
