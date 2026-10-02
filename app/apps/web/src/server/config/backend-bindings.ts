export type BackendEnvironment =
  "development" | "test" | "preview" | "production";
export type BindingIssue = {
  variable: string;
  code:
    "MISSING" | "INVALID" | "MODE_MISMATCH" | "PUBLIC_SECRET" | "UNSAFE_ROLE";
};

export type BackendBindings = {
  environment: BackendEnvironment;
  application: { origin: string; region: string };
  identity: { provider: "clerk"; applicationId: string; mode: "test" | "live" };
  database: {
    provider: "neon";
    projectId: string;
    branchId: string;
    purpose: BackendEnvironment;
    region: string;
    databaseName: string;
    runtimeRole: string;
  };
};

const environments = ["development", "test", "preview", "production"] as const;
const requiredVariables = [
  "TREIDO_ENV",
  "TREIDO_DATA_MODE",
  "TREIDO_APP_ORIGIN",
  "TREIDO_APP_REGION",
  "TREIDO_CLERK_APP_ID",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "TREIDO_NEON_PROJECT_ID",
  "TREIDO_NEON_BRANCH_ID",
  "TREIDO_NEON_BRANCH_PURPOSE",
  "TREIDO_DB_REGION",
  "TREIDO_DB_DATABASE",
  "TREIDO_DB_ROLE",
  "DATABASE_URL",
] as const;

/** Syntax and declared-target validation only; no authentication or provider connection. */
export function validateBackendBindings(
  env: Readonly<Record<string, string | undefined>>,
):
  | { ok: true; bindings: BackendBindings }
  | { ok: false; issues: BindingIssue[] } {
  const issues: BindingIssue[] = [];
  const value = (name: string) => env[name] ?? "";
  function reject(variable: string, code: BindingIssue["code"] = "INVALID") {
    if (!issues.some((issue) => issue.variable === variable))
      issues.push({ variable, code });
  }
  for (const variable of requiredVariables) {
    if (!value(variable).trim()) reject(variable, "MISSING");
  }
  for (const variable of Object.keys(env)) {
    if (
      /^NEXT_PUBLIC_.*(?:DATABASE|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_KEY)/.test(
        variable,
      ) &&
      value(variable)
    ) {
      reject(variable, "PUBLIC_SECRET");
    }
  }
  if (!environments.includes(value("TREIDO_ENV") as BackendEnvironment))
    reject("TREIDO_ENV");
  const environment = value("TREIDO_ENV") as BackendEnvironment;
  if (
    ["preview", "production"].includes(value("VERCEL_ENV")) &&
    value("VERCEL_ENV") !== environment
  ) {
    reject("TREIDO_ENV", "MODE_MISMATCH");
  }
  if (value("TREIDO_DATA_MODE") !== "database") reject("TREIDO_DATA_MODE");
  const production = environment === "production";
  const keyMode = production ? "live" : "test";
  for (const [variable, prefix] of [
    ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk"],
    ["CLERK_SECRET_KEY", "sk"],
  ] as const) {
    if (
      !new RegExp(`^${prefix}_${keyMode}_[A-Za-z0-9_+=/-]+$`).test(
        value(variable),
      )
    ) {
      reject(variable, "MODE_MISMATCH");
    }
  }
  if (value("TREIDO_NEON_BRANCH_PURPOSE") !== environment)
    reject("TREIDO_NEON_BRANCH_PURPOSE", "MODE_MISMATCH");
  for (const [variable, pattern] of [
    ["TREIDO_APP_REGION", /^[a-z][a-z0-9-]{1,63}$/],
    ["TREIDO_DB_REGION", /^[a-z][a-z0-9-]{1,63}$/],
    ["TREIDO_CLERK_APP_ID", /^app_[A-Za-z0-9]{3,128}$/],
    ["TREIDO_NEON_PROJECT_ID", /^[a-z0-9][a-z0-9-]{2,127}$/],
    ["TREIDO_NEON_BRANCH_ID", /^br-[a-z0-9-]{3,127}$/],
    ["TREIDO_DB_DATABASE", /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/],
    ["TREIDO_DB_ROLE", /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/],
  ] as const) {
    if (!pattern.test(value(variable))) reject(variable);
  }
  if (["postgres", "neondb_owner"].includes(value("TREIDO_DB_ROLE")))
    reject("TREIDO_DB_ROLE", "UNSAFE_ROLE");

  let origin = "";
  try {
    const url = new URL(value("TREIDO_APP_ORIGIN"));
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const secure = url.protocol === "https:";
    if (
      (!secure &&
        !(
          url.protocol === "http:" &&
          local &&
          ["development", "test"].includes(environment)
        )) ||
      (local && ["preview", "production"].includes(environment)) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      reject("TREIDO_APP_ORIGIN");
    } else origin = url.origin;
  } catch {
    reject("TREIDO_APP_ORIGIN");
  }

  try {
    const url = new URL(value("DATABASE_URL"));
    const ssl = url.searchParams.getAll("sslmode");
    const parameterNames = [...url.searchParams.keys()];
    const allowedParameters = [
      "sslmode",
      "channel_binding",
      "connect_timeout",
      "application_name",
    ];
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname.endsWith(".neon.tech") ||
      !url.password ||
      url.hash ||
      decodeURIComponent(url.username) !== value("TREIDO_DB_ROLE") ||
      decodeURIComponent(url.pathname.slice(1)) !==
        value("TREIDO_DB_DATABASE") ||
      !url.hostname.split(".").includes(value("TREIDO_DB_REGION")) ||
      ssl.length !== 1 ||
      !["require", "verify-ca", "verify-full"].includes(ssl[0]) ||
      parameterNames.some((name) => !allowedParameters.includes(name)) ||
      new Set(parameterNames).size !== parameterNames.length
    ) {
      reject("DATABASE_URL");
    }
  } catch {
    reject("DATABASE_URL");
  }

  if (issues.length) return { ok: false, issues };
  // Deliberately omit keys, credentials, raw connection URLs and exception messages.
  return {
    ok: true,
    bindings: {
      environment,
      application: { origin, region: value("TREIDO_APP_REGION") },
      identity: {
        provider: "clerk",
        applicationId: value("TREIDO_CLERK_APP_ID"),
        mode: keyMode,
      },
      database: {
        provider: "neon",
        projectId: value("TREIDO_NEON_PROJECT_ID"),
        branchId: value("TREIDO_NEON_BRANCH_ID"),
        purpose: environment,
        region: value("TREIDO_DB_REGION"),
        databaseName: value("TREIDO_DB_DATABASE"),
        runtimeRole: value("TREIDO_DB_ROLE"),
      },
    },
  };
}
