import { readFile, stat } from "node:fs/promises";
import { pathToFileURL, URL } from "node:url";
import process from "node:process";
import { Client } from "pg";
import {
  deriveDevelopmentDatabaseEnvironment,
  validateDatabaseBindings,
} from "../src/server/config/backend-bindings.ts";
import {
  CategoryMaintenanceError,
  parseReviewedPacket,
  parseMaintenancePlan,
  createMaintenancePlan,
  applyMaintenancePlan,
} from "./category-policy-maintenance-core.mjs";

export const maintenanceHelp = `Category policy maintenance (Node 24.20.0; run from app/)

Plan, using an actual reviewed packet and an already authorized maintenance target:
  node apps/web/scripts/category-policy-maintenance.mjs --plan review.json --review-sha256 <SHA256> --branch <intended branch ID>
Apply the reviewed exact plan, with the same review packet:
  node apps/web/scripts/category-policy-maintenance.mjs --apply plan.json --plan-sha256 <SHA256> --review review.json --review-sha256 <SHA256> --branch <intended branch ID>
  node apps/web/scripts/category-policy-maintenance.mjs --help

The command reads only the protected process environment. It does not load env files.
Use existing TREIDO_ENV, TREIDO_DATA_MODE=database, TREIDO_NEON_PROJECT_ID,
TREIDO_NEON_BRANCH_ID, TREIDO_NEON_BRANCH_PURPOSE, TREIDO_DB_REGION,
TREIDO_DB_DATABASE, TREIDO_DB_ROLE and DATABASE_URL bindings, and the same
database's direct TLS MIGRATION_DATABASE_URL with the separately authorized
maintenance login. The existing Development bridge is supported. Runtime cannot
write category policies. No Clerk or payment credentials are required.

Review JSON has EXACT fields:
{format:"treido-category-review-v1", target:{application:"treido-eu",
environment:"development|test|preview|production", projectId, branchId, database,
region, runtimeRole, maintenanceRole, country:"BG"}, authorizationReference,
decision:{reference,reviewedBy,reviewedAt:<UTC ISO timestamp with milliseconds>,
goodsScope:"ordinary-physical-nonregulated"}, policies:[{categoryId,
sellerKinds,conditions,handoverModes:["pickup"],purchaseModes:["contact"]}]}
authorizationReference records the actual operator/target authorization;
decision records the actual category review. These inputs are attestations;
the command cannot establish their authenticity or grant authority.

This first scope supports only cat:books-media/fiction, personal/business sellers,
and existing new/new_other/like_new/good/fair conditions. Counts are bounded 1–12;
duplicates/unsupported leaves fail. Existing restrictions and other candidate
rules are preserved. No shipping, checkout, regulated goods or other leaf activation.

The maintenance login must already have SELECT, INSERT and the table privileges
required for SHARE ROW EXCLUSIVE locks on category_registry_versions, categories
and category_policies (the existing owner/maintenance role). This tool grants nothing.

Workflow: complete actual review and target authorization first; hash exact packet
bytes with lowercase SHA256 hex (PowerShell: (Get-FileHash -Algorithm SHA256
-LiteralPath review.json).Hash.ToLowerInvariant()); plan and retain stdout as
plan.json; inspect target, registry,
category and latest-policy preimages and next-version proposal; hash exact plan
bytes; authorize that result before applying it. Keep both files and the receipt.
Plan performs a read-only transaction. Apply locks and compares the entire packet,
appends next reviewed version atomically, and never updates historical rows.
Only identical latest-version replay succeeds without another append. A stale
registry/category/policy aborts; obtain a new review and plan. Publication still
requires an explicit draft save, seller authority, real media and acknowledgments.
`;

const fail = (code) => {
  throw new CategoryMaintenanceError(code);
};
export function maintenanceArguments(args) {
  if (args.length === 1 && args[0] === "--help") return { mode: "help" };
  if (
    args.length === 6 &&
    args[0] === "--plan" &&
    args[2] === "--review-sha256" &&
    args[4] === "--branch"
  )
    return {
      mode: "plan",
      reviewFile: args[1],
      reviewHash: args[3],
      branch: args[5],
    };
  if (
    args.length === 10 &&
    args[0] === "--apply" &&
    args[2] === "--plan-sha256" &&
    args[4] === "--review" &&
    args[6] === "--review-sha256" &&
    args[8] === "--branch"
  )
    return {
      mode: "apply",
      planFile: args[1],
      planHash: args[3],
      reviewFile: args[5],
      reviewHash: args[7],
      branch: args[9],
    };
  fail("EXPLICIT_PLAN_OR_APPLY_REQUIRED_USE_HELP");
}

/** Same protected binding and direct-endpoint boundary as the migration command.
 * Provider project/branch ownership must already be qualified by the operator. */
export function qualifiedMaintenanceConnection(env, target, branch) {
  let resolved, configured, migration, runtime;
  try {
    resolved = deriveDevelopmentDatabaseEnvironment(env);
    configured = validateDatabaseBindings(resolved);
    if (!configured.ok) fail("INVALID_PROTECTED_DATABASE_BINDINGS");
    migration = new URL(env.MIGRATION_DATABASE_URL ?? "");
    runtime = new URL(resolved.DATABASE_URL);
  } catch {
    fail("INVALID_PROTECTED_DATABASE_BINDINGS");
  }
  const { environment, database } = configured.bindings;
  if (
    branch !== target.branchId ||
    environment !== target.environment ||
    database.projectId !== target.projectId ||
    database.branchId !== target.branchId ||
    database.databaseName !== target.database ||
    database.region !== target.region ||
    database.runtimeRole !== target.runtimeRole
  )
    fail("DECLARED_TARGET_MISMATCH");
  const ssl = migration.searchParams.getAll("sslmode");
  const allowed = [
    "sslmode",
    "channel_binding",
    "connect_timeout",
    "application_name",
  ];
  if (
    !["postgres:", "postgresql:"].includes(migration.protocol) ||
    migration.hostname.includes("-pooler.") ||
    migration.hostname !== runtime.hostname.replace("-pooler.", ".") ||
    migration.port !== runtime.port ||
    migration.pathname !== runtime.pathname ||
    !migration.password ||
    /^[*\u2022\u25cf\u2026]{3,}$/u.test(
      decodeURIComponent(migration.password),
    ) ||
    migration.hash ||
    decodeURIComponent(migration.username) !== target.maintenanceRole ||
    target.maintenanceRole === database.runtimeRole ||
    ssl.length !== 1 ||
    !["require", "verify-ca", "verify-full"].includes(ssl[0]) ||
    [...migration.searchParams.keys()].some(
      (key) =>
        !allowed.includes(key) ||
        migration.searchParams.getAll(key).length !== 1,
    )
  )
    fail("DIRECT_MAINTENANCE_TLS_CONNECTION_REQUIRED");
  return migration.href;
}
async function boundedFile(path, max) {
  const info = await stat(path);
  if (!info.isFile() || info.size > max)
    fail("INPUT_FILE_TOO_LARGE_OR_INVALID");
  return readFile(path);
}
export async function runMaintenance(args, env) {
  const options = maintenanceArguments(args);
  if (options.mode === "help") return maintenanceHelp;
  if (process.version !== "v24.20.0") fail("PINNED_NODE_24_20_0_REQUIRED");
  const review = parseReviewedPacket(
    await boundedFile(options.reviewFile, 65536),
    options.reviewHash,
  );
  const plan =
    options.mode === "apply"
      ? parseMaintenancePlan(
          await boundedFile(options.planFile, 262144),
          options.planHash,
        )
      : null;
  const client = new Client({
    connectionString: qualifiedMaintenanceConnection(
      env,
      review.packet.target,
      options.branch,
    ),
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    lock_timeout: 5000,
    application_name: "treido-category-policy-maintenance",
  });
  try {
    await client.connect();
    const result =
      options.mode === "plan"
        ? await createMaintenancePlan(client, review)
        : await applyMaintenancePlan(client, plan, review);
    return `${JSON.stringify(result, null, 2)}\n`;
  } finally {
    await client.end();
  }
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    process.stdout.write(
      await runMaintenance(process.argv.slice(2), process.env),
    );
  } catch (error) {
    // pg/URL/file errors may contain credentials or private paths. Never print them.
    process.stderr.write(
      `${error instanceof CategoryMaintenanceError ? error.message : "MAINTENANCE_FAILED_NO_CHANGES_CONFIRMED_RECHECK_ORIGINAL_PLAN"}\n`,
    );
    process.exitCode = 1;
  }
}
