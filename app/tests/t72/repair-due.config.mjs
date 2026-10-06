import { defineConfig } from "vitest/config";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../..");
export default defineConfig({
  root,
  resolve: {
    alias: { "server-only": path.join(root, "tests/t61/server-only.mjs") },
  },
  test: {
    include: ["tests/t72/repair-due.integration.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    hookTimeout: 90000,
    testTimeout: 30000,
  },
});
