import { defineConfig } from "vitest/config";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.join(root, "apps/web/src"),
      "server-only": path.join(root, "tests/t61/server-only.mjs"),
    },
  },
  test: {
    include: [
      "tests/t71/native-security.integration.ts",
      "tests/t71/billing-scheduler.integration.ts",
      "apps/web/src/features/team/issuer.test.ts",
    ],
    maxWorkers: 1,
    fileParallelism: false,
    hookTimeout: 90000,
    testTimeout: 30000,
  },
});
