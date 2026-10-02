import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) },
  },
  test: {
    include: ["apps/web/src/**/*.integration.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    hookTimeout: 90000,
    testTimeout: 20000,
  },
});
