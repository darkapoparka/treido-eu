import {
  platformOptions,
  PlatformConfigurationError,
} from "./platform-options.mjs";
import {
  assertPlatformPortFree,
  spawnPlatformRuntime,
} from "./platform-process.mjs";

try {
  const options = platformOptions(process.env, process.argv.slice(2));
  await assertPlatformPortFree(options.port);
  const { child } = await spawnPlatformRuntime(options);
  if (options.background) {
    console.log(
      "Treido platform process launched:",
      options.origin,
      "PID",
      child.pid,
    );
    console.log("Startup output:", options.output + "/launcher.log");
    console.log(
      "Provider readiness must be verified through the development journey.",
    );
  }
} catch (error) {
  console.error(
    error instanceof PlatformConfigurationError
      ? error.message
      : "The platform could not start. Check its port and project-local startup log. Provider errors and credentials are not logged here.",
  );
  process.exitCode = 1;
}
