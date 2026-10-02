import { spawn } from "node:child_process";
import { mkdirSync, openSync, closeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { previewOptions } from "./preview-options.mjs";

const options = previewOptions();
const background = process.argv.slice(2).includes("--background");
if (process.argv.slice(2).some((arg) => arg !== "--background"))
  throw new Error("Use --background or no arguments.");
const root = fileURLToPath(new URL("../", import.meta.url));
const next = fileURLToPath(import.meta.resolve("next/dist/bin/next"));
// A detached preview survives the agent terminal. Output remains in this project.
const output = background
  ? ".qa/treido-preview-background"
  : options.env.SHOP_PARITY_DIST_DIR;
let log;
if (background) {
  mkdirSync(new URL("../.qa/treido-preview-background/", import.meta.url), {
    recursive: true,
  });
  log = openSync(
    new URL("../.qa/treido-preview-background/launcher.log", import.meta.url),
    "a",
  );
}
const child = spawn(process.execPath, [next, ...options.args], {
  cwd: root,
  detached: background,
  windowsHide: background,
  stdio: background ? ["ignore", log, log] : "inherit",
  env: { ...process.env, ...options.env, SHOP_PARITY_DIST_DIR: output },
});
if (log !== undefined) closeSync(log);
child.on("error", (error) => {
  console.error("Treido preview could not start:", error.message);
  process.exitCode = 1;
});
if (background) {
  child.unref();
  console.log(
    "Treido preview launched:",
    "http://127.0.0.1:" + options.port,
    "PID",
    child.pid,
  );
  console.log("Startup output:", output + "/launcher.log");
} else {
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
}
