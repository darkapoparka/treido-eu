import { spawn } from "node:child_process";
import { mkdirSync, openSync, closeSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Never take over an existing listener, including another platform process. */
export async function assertPlatformPortFree(port) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(new Error("Platform port is unavailable.")),
    );
    probe.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      probe.close((error) => (error ? reject(error) : resolve())),
    );
  });
}

/** The same detached, file-backed process pattern as the reference launcher. */
export async function spawnPlatformRuntime(
  options,
  {
    root = fileURLToPath(new URL("../", import.meta.url)),
    runtimeFile = fileURLToPath(import.meta.resolve("next/dist/bin/next")),
    environment = process.env,
  } = {},
) {
  const logPath = join(root, options.output, "launcher.log");
  let log;
  let child;
  try {
    if (options.background) {
      mkdirSync(join(root, options.output), { recursive: true });
      log = openSync(logPath, "a");
    }
    child = spawn(process.execPath, [runtimeFile, ...options.args], {
      cwd: root,
      detached: options.background,
      windowsHide: true,
      stdio: options.background ? ["ignore", log, log] : "inherit",
      env: { ...environment, ...options.env },
    });
  } finally {
    if (log !== undefined) closeSync(log);
  }
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", () =>
      reject(new Error("Platform process could not start.")),
    );
  });
  if (options.background) child.unref();
  else {
    const interrupt = () => child.kill("SIGINT");
    const terminate = () => child.kill("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    child.once("exit", (code, signal) => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
      process.exitCode = code ?? (signal ? 1 : 0);
    });
  }
  return { child, logPath };
}
