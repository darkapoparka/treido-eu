import { describe, expect, it } from "vitest";
import {
  deriveDevelopmentDatabaseEnvironment,
  validateBackendBindings,
  validateDatabaseBindings,
} from "./backend-bindings";

// Configuration fixtures only, not evidence of provider connectivity.
const configuration = {
  TREIDO_ENV: "development",
  TREIDO_DATA_MODE: "database",
  TREIDO_NEON_PROJECT_ID: "synthetic-project-123",
  TREIDO_NEON_BRANCH_ID: "br-synthetic-123",
  TREIDO_NEON_BRANCH_PURPOSE: "development",
  TREIDO_DB_REGION: "eu-central-1",
  TREIDO_DB_DATABASE: "treido_test",
  TREIDO_DB_ROLE: "treido_runtime",
  DATABASE_URL:
    "postgresql://treido_runtime:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=verify-full",
};

describe("database-only configuration boundary", () => {
  it("permits database qualification without manufacturing identity credentials", () => {
    const result = validateDatabaseBindings(configuration);
    expect(result.ok).toBe(true);
    expect(validateBackendBindings(configuration).ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("syntheticPassword");
    expect(JSON.stringify(result)).not.toContain(configuration.DATABASE_URL);
    expect(result).not.toHaveProperty("bindings.identity");
  });
  it.each(Object.keys(configuration))(
    "still requires database variable %s",
    (key) => {
      const env: Record<string, string> = { ...configuration };
      delete env[key];
      expect(validateDatabaseBindings(env)).toMatchObject({
        ok: false,
        issues: expect.arrayContaining([{ variable: key, code: "MISSING" }]),
      });
    },
  );
  it.each([
    { TREIDO_ENV: "staging" },
    { TREIDO_DATA_MODE: "reference" },
    { TREIDO_NEON_BRANCH_PURPOSE: "production" },
    { VERCEL_ENV: "production" },
    { NEXT_PUBLIC_DATABASE_URL: "privateValue" },
    { NEXT_PUBLIC_CLERK_SECRET_KEY: "privateValue" },
    { TREIDO_DB_REGION: "us-east-1" },
    { TREIDO_DB_ROLE: "neondb_owner" },
    {
      DATABASE_URL: configuration.DATABASE_URL.replace(
        "verify-full",
        "disable",
      ),
    },
    { DATABASE_URL: configuration.DATABASE_URL + "&sslmode=disable" },
    {
      DATABASE_URL:
        configuration.DATABASE_URL + "&options=-csearch_path%3Dpublic",
    },
    {
      DATABASE_URL: configuration.DATABASE_URL.replace(
        "aws.neon.tech",
        "aws.neon.tech.evil.example",
      ),
    },
  ])("retains database and public-secret denials %#", (override) => {
    const result = validateDatabaseBindings({ ...configuration, ...override });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("privateValue");
    expect(JSON.stringify(result)).not.toContain("syntheticPassword");
  });
});

describe("copied database password masks", () => {
  it.each([
    "****************",
    "%2A%2A%2A%2A",
    "%E2%80%A2%E2%80%A2%E2%80%A2",
    "\u25cf\u25cf\u25cf",
    "\u2026\u2026\u2026",
  ])(
    "rejects a copied display mask %# without exposing the URL",
    (password) => {
      const DATABASE_URL = configuration.DATABASE_URL.replace(
        "syntheticPassword",
        password,
      );
      for (const validate of [
        validateDatabaseBindings,
        validateBackendBindings,
      ]) {
        const result = validate({ ...configuration, DATABASE_URL });
        expect(result).toMatchObject({
          ok: false,
          issues: expect.arrayContaining([
            { variable: "DATABASE_URL", code: "MASKED_CREDENTIAL" },
          ]),
        });
        expect(JSON.stringify(result)).not.toContain(DATABASE_URL);
      }
    },
  );
  it("does not reject actual passwords merely containing an asterisk", () => {
    const DATABASE_URL = configuration.DATABASE_URL.replace(
      "syntheticPassword",
      "synthetic*Password",
    );
    expect(
      validateDatabaseBindings({ ...configuration, DATABASE_URL }).ok,
    ).toBe(true);
  });
});

const bridgeConfiguration = {
  ...configuration,
  TREIDO_DB_LOGIN_ROLE: "treido_dev_bridge",
  TREIDO_DB_LOCAL_BRIDGE: "true",
  DATABASE_URL:
    "postgresql://treido_dev_bridge:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=verify-full&options=-c%20role%3Dtreido_runtime",
};

describe("development-only runtime login bridge", () => {
  it("accepts an unpooled login whose startup role is the restricted runtime role", () => {
    const result = validateDatabaseBindings(bridgeConfiguration);
    expect(result).toMatchObject({
      ok: true,
      bindings: {
        database: {
          loginRole: "treido_dev_bridge",
          runtimeRole: "treido_runtime",
          localBridge: true,
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("syntheticPassword");
  });

  it.each([
    { TREIDO_DB_LOGIN_ROLE: "" },
    { TREIDO_DB_LOGIN_ROLE: "treido_runtime" },
    { TREIDO_DB_LOGIN_ROLE: "neondb_owner" },
    { TREIDO_DB_LOCAL_BRIDGE: "sometimes" },
    { TREIDO_DB_LOCAL_BRIDGE: "false" },
    {
      TREIDO_ENV: "test",
      TREIDO_NEON_BRANCH_PURPOSE: "test",
    },
    {
      DATABASE_URL: bridgeConfiguration.DATABASE_URL.replace(
        "ep-synthetic.",
        "ep-synthetic-pooler.",
      ),
    },
    {
      DATABASE_URL: bridgeConfiguration.DATABASE_URL.replace(
        "treido_dev_bridge:",
        "treido_runtime:",
      ),
    },
    {
      DATABASE_URL: bridgeConfiguration.DATABASE_URL.replace(
        "&options=-c%20role%3Dtreido_runtime",
        "",
      ),
    },
    {
      DATABASE_URL: bridgeConfiguration.DATABASE_URL.replace(
        "role%3Dtreido_runtime",
        "role%3Dtreido_dev_bridge",
      ),
    },
    {
      DATABASE_URL:
        bridgeConfiguration.DATABASE_URL +
        "&options=-c%20role%3Dtreido_runtime",
    },
  ])("rejects an unsafe bridge declaration %#", (override) => {
    expect(
      validateDatabaseBindings({ ...bridgeConfiguration, ...override }).ok,
    ).toBe(false);
  });
});

describe("development bridge derivation", () => {
  const source = {
    ...configuration,
    DATABASE_URL: "",
    TREIDO_DB_LOCAL_BRIDGE: "true",
    MIGRATION_DATABASE_URL:
      "postgresql://treido_migration:bridgeSecret@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=verify-full",
  };
  it("derives a direct startup-role connection without exposing the URL in bindings", () => {
    const env = deriveDevelopmentDatabaseEnvironment(source);
    const url = new URL(env.DATABASE_URL!);
    expect(env.TREIDO_DB_LOGIN_ROLE).toBe("treido_migration");
    expect(url.searchParams.get("options")).toBe("-c role=treido_runtime");
    expect(validateDatabaseBindings(env).ok).toBe(true);
    expect(JSON.stringify(validateDatabaseBindings(env))).not.toContain(
      "bridgeSecret",
    );
  });
  it.each([
    { TREIDO_ENV: "test", TREIDO_NEON_BRANCH_PURPOSE: "test" },
    { MIGRATION_DATABASE_URL: "" },
    {
      MIGRATION_DATABASE_URL:
        "postgresql://treido_runtime:bridgeSecret@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=require",
    },
    {
      MIGRATION_DATABASE_URL:
        "postgresql://treido_migration:bridgeSecret@ep-synthetic-pooler.eu-central-1.aws.neon.tech/treido_test?sslmode=require",
    },
    {
      MIGRATION_DATABASE_URL:
        "postgresql://treido_migration:bridgeSecret@ep-synthetic.us-east-1.aws.neon.tech/treido_test?sslmode=require",
    },
  ])("rejects an unsafe source %#", (override) => {
    expect(() =>
      deriveDevelopmentDatabaseEnvironment({ ...source, ...override }),
    ).toThrow("Invalid development database bridge");
  });
});
