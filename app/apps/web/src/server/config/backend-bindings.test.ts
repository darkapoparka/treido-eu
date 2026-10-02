import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  validateBackendBindings,
  type BackendEnvironment,
} from "./backend-bindings";
import {
  BackendConfigurationError,
  requireBackendBindings,
} from "./backend-bindings.server";

// Synthetic strings only. These do not target an existing application or database.
function fixture(
  environment: BackendEnvironment = "test",
): Record<string, string> {
  const mode = environment === "production" ? "live" : "test";
  return {
    TREIDO_ENV: environment,
    TREIDO_DATA_MODE: "database",
    TREIDO_APP_ORIGIN:
      environment === "development" || environment === "test"
        ? "http://127.0.0.1:6418"
        : "https://treido.example",
    TREIDO_APP_REGION: "fra1",
    TREIDO_CLERK_APP_ID: "app_synthetic123",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: `pk_${mode}_syntheticPublishable`,
    CLERK_SECRET_KEY: `sk_${mode}_syntheticSecret`,
    TREIDO_NEON_PROJECT_ID: "synthetic-project-123",
    TREIDO_NEON_BRANCH_ID: "br-synthetic-123",
    TREIDO_NEON_BRANCH_PURPOSE: environment,
    TREIDO_DB_REGION: "eu-central-1",
    TREIDO_DB_DATABASE: "treido_test",
    TREIDO_DB_ROLE: "treido_runtime",
    DATABASE_URL:
      "postgresql://treido_runtime:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=require",
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("backend configuration boundary", () => {
  it.each<BackendEnvironment>(["development", "test", "preview", "production"])(
    "returns only target metadata for %s",
    (environment) => {
      const env = fixture(environment);
      const result = validateBackendBindings(env);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected synthetic valid configuration");
      expect(result.bindings.environment).toBe(environment);
      expect(result.bindings.database.branchId).toBe(env.TREIDO_NEON_BRANCH_ID);
      expect(result.bindings.identity.mode).toBe(
        environment === "production" ? "live" : "test",
      );
      const serialized = JSON.stringify(result);
      for (const value of [
        env.CLERK_SECRET_KEY,
        env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        env.DATABASE_URL,
        "syntheticPassword",
      ]) {
        expect(serialized).not.toContain(value);
      }
    },
  );

  it("fails closed for absent bindings, without duplicate variable diagnostics", () => {
    const result = validateBackendBindings({});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected missing configuration");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { variable: "CLERK_SECRET_KEY", code: "MISSING" },
        { variable: "DATABASE_URL", code: "MISSING" },
        { variable: "TREIDO_NEON_BRANCH_ID", code: "MISSING" },
      ]),
    );
    expect(new Set(result.issues.map((issue) => issue.variable)).size).toBe(
      result.issues.length,
    );
  });

  it.each([
    ["test", "sk_live_syntheticSecret"],
    ["production", "sk_test_syntheticSecret"],
  ] as const)("rejects wrong Clerk key mode in %s", (environment, key) => {
    expect(
      validateBackendBindings({
        ...fixture(environment),
        CLERK_SECRET_KEY: key,
      }),
    ).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { variable: "CLERK_SECRET_KEY", code: "MODE_MISMATCH" },
      ]),
    });
  });

  it.each([
    { TREIDO_DATA_MODE: "reference" },
    { TREIDO_ENV: "staging" },
    { TREIDO_NEON_BRANCH_PURPOSE: "production" },
    { VERCEL_ENV: "production" },
    { NEXT_PUBLIC_DATABASE_URL: "synthetic-public-secret" },
    { NEXT_PUBLIC_CLERK_SECRET_KEY: "synthetic-public-secret" },
  ])("rejects inconsistent or public-secret configuration %j", (overrides) => {
    expect(validateBackendBindings({ ...fixture(), ...overrides }).ok).toBe(
      false,
    );
  });

  it.each([
    "http://treido.example",
    "https://user:password@treido.example",
    "https://treido.example/app",
    "https://treido.example?returnTo=elsewhere",
    "https://treido.example#app",
    "http://127.0.0.1.evil.example",
    "not-an-origin",
  ])("rejects a noncanonical origin %s", (origin) => {
    expect(
      validateBackendBindings({ ...fixture(), TREIDO_APP_ORIGIN: origin }),
    ).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        { variable: "TREIDO_APP_ORIGIN", code: "INVALID" },
      ]),
    });
  });

  it.each(["http://127.0.0.1:6418", "https://localhost", "https://[::1]"])(
    "rejects loopback as a hosted application origin %s",
    (origin) => {
      expect(
        validateBackendBindings({
          ...fixture("preview"),
          TREIDO_APP_ORIGIN: origin,
        }).ok,
      ).toBe(false);
    },
  );

  it.each([
    "postgresql://treido_runtime:syntheticPassword@foreign.example/treido_test?sslmode=require",
    "postgresql://treido_runtime:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech.evil.example/treido_test?sslmode=require",
    "postgresql://foreign_role:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=require",
    "postgresql://treido_runtime:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/foreign_db?sslmode=require",
    "postgresql://treido_runtime:syntheticPassword@ep-synthetic.us-east-1.aws.neon.tech/treido_test?sslmode=require",
    "postgresql://treido_runtime@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=require",
    "postgresql://treido_runtime:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/treido_test",
    "postgresql://treido_runtime:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=disable",
    "postgresql://treido_runtime:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=require&sslmode=disable",
    "postgresql://treido_runtime:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/treido_test?sslmode=require&options=-csearch_path%3Dpublic",
    "postgresql://treido_runtime:syntheticPassword@ep-synthetic.eu-central-1.aws.neon.tech/%ZZ?sslmode=require",
  ])(
    "rejects an unsafe or mismatched connection declaration %#",
    (databaseUrl) => {
      const result = validateBackendBindings({
        ...fixture(),
        DATABASE_URL: databaseUrl,
      });
      expect(result).toMatchObject({
        ok: false,
        issues: expect.arrayContaining([
          { variable: "DATABASE_URL", code: "INVALID" },
        ]),
      });
      expect(JSON.stringify(result)).not.toContain(databaseUrl);
      expect(JSON.stringify(result)).not.toContain("syntheticPassword");
    },
  );

  it.each(["postgres", "neondb_owner"])(
    "rejects privileged default runtime role %s",
    (role) => {
      const env = fixture();
      const url = new URL(env.DATABASE_URL);
      url.username = role;
      expect(
        validateBackendBindings({
          ...env,
          TREIDO_DB_ROLE: role,
          DATABASE_URL: url.href,
        }),
      ).toMatchObject({
        ok: false,
        issues: expect.arrayContaining([
          { variable: "TREIDO_DB_ROLE", code: "UNSAFE_ROLE" },
        ]),
      });
    },
  );

  it("reads server env and exposes only generic errors on invalid configuration", () => {
    for (const [name, value] of Object.entries(fixture()))
      vi.stubEnv(name, value);
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_DATABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CLERK_SECRET_KEY", "");
    expect(requireBackendBindings().identity.applicationId).toBe(
      "app_synthetic123",
    );
    vi.stubEnv("DATABASE_URL", "invalid-synthetic-sensitive-url");
    expect(requireBackendBindings).toThrow(BackendConfigurationError);
    try {
      requireBackendBindings();
    } catch (error) {
      expect(error).toBeInstanceOf(BackendConfigurationError);
      if (!(error instanceof BackendConfigurationError)) throw error;
      expect(error.message).toBe(
        "Treido backend configuration is missing or invalid.",
      );
      expect(JSON.stringify(error)).not.toContain(
        "invalid-synthetic-sensitive-url",
      );
      expect(JSON.stringify(error)).not.toContain("syntheticSecret");
    }
  });
});
