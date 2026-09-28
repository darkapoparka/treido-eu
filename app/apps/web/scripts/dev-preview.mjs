import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Explicit local-only Shop reconstruction entry, not a production fallback.
const root = fileURLToPath(new URL("../", import.meta.url));
const next = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
const child = spawn(
  process.execPath,
  [next, "dev", "--hostname", "127.0.0.1", "--port", "6412"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      SHOP_REFERENCE_PREVIEW: "1",
      VERCEL_ENV: "preview",
      SHOP_PARITY_DIST_DIR: ".qa/shelves-dev",
      SHOP_PARITY_TSCONFIG_PATH: "tsconfig.preview.json",
    },
  },
);

child.on("error", (error) => {
  console.error("Shop preview could not start:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
