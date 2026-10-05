import {
  deriveDevelopmentDatabaseEnvironment,
  validateBackendBindings,
} from "../src/server/config/backend-bindings.ts";
import { validateJobBindings } from "../src/server/jobs/bindings.ts";
import { validateMediaBindings } from "../src/server/media/bindings.ts";

export class PlatformConfigurationError extends Error {}

/** Declared configuration only. A valid shape is not provider acceptance. */
export function platformOptions(env = process.env, args = []) {
  if (args.length > 1 || args.some((arg) => arg !== "--background"))
    throw new PlatformConfigurationError("Use --background or no arguments.");
  if (env.VERCEL || env.NODE_ENV === "production")
    throw new PlatformConfigurationError(
      "The development platform is local-only.",
    );
  let resolvedEnv;
  try {
    resolvedEnv = deriveDevelopmentDatabaseEnvironment(env);
  } catch {
    throw new PlatformConfigurationError(
      "Configure the isolated development database bridge. Values are not logged.",
    );
  }
  const backend = validateBackendBindings(resolvedEnv);
  const jobs = validateJobBindings(resolvedEnv);
  const media = validateMediaBindings(resolvedEnv);
  if (
    !backend.ok &&
    backend.issues.some((issue) => issue.code === "MASKED_CREDENTIAL")
  )
    throw new PlatformConfigurationError(
      "DATABASE_URL contains a masked password. Copy the unmasked runtime connection into web .env.local and save it; never paste it into chat.",
    );
  const invalid = new Set([
    ...(backend.ok ? [] : backend.issues.map((issue) => issue.variable)),
    ...(jobs.ok ? [] : jobs.missing),
    ...(media.ok ? [] : media.variables),
  ]);
  if (invalid.size)
    throw new PlatformConfigurationError(
      "Configure the intended development providers in web .env.local. Missing or invalid variables: " +
        [...invalid].sort().join(", ") +
        ". Values are not logged.",
    );
  if (backend.bindings.environment !== "development")
    throw new PlatformConfigurationError(
      "Use confirmed development resources only.",
    );
  const origin = new URL(backend.bindings.application.origin);
  const port = Number(origin.port);
  if (
    origin.protocol !== "http:" ||
    origin.hostname !== "127.0.0.1" ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535 ||
    [6412, 6413, 6414, 6418].includes(port)
  )
    throw new PlatformConfigurationError(
      "Use a free loopback port in TREIDO_APP_ORIGIN, normally http://127.0.0.1:6419. Reference/Foods ports are reserved.",
    );
  const background = args.includes("--background");
  const output = background
    ? ".qa/treido-platform-background"
    : ".qa/treido-platform";
  const bridgeEnvironment = backend.bindings.database.localBridge
    ? {
        DATABASE_URL: resolvedEnv.DATABASE_URL,
        TREIDO_DB_LOGIN_ROLE: resolvedEnv.TREIDO_DB_LOGIN_ROLE,
        TREIDO_DB_LOCAL_BRIDGE: "true",
      }
    : {};
  return {
    background,
    output,
    port,
    origin: origin.origin,
    args: ["dev", "--hostname", "127.0.0.1", "--port", String(port)],
    env: {
      SHOP_REFERENCE_PREVIEW: "0",
      SHOP_PARITY_DIST_DIR: output,
      SHOP_PARITY_TSCONFIG_PATH: "tsconfig.treido-platform.json",
      INNGEST_DEV: "false",
      ...bridgeEnvironment,
      // An explicit empty value prevents Next's env-file loader restoring it.
      MIGRATION_DATABASE_URL: "",
    },
  };
}
