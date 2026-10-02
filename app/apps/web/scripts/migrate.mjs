import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { validateBackendBindings } from "../src/server/config/backend-bindings.ts";
import { applyReviewedMigration } from "./identity-draft-migration.mjs";
import { applyRuntimeGrants } from "./runtime-grants.mjs";

async function main() {
  const configured = validateBackendBindings(process.env);
  if (!configured.ok)
    throw new Error(
      "Set the intended backend bindings before running migrations.",
    );
  const { database, environment } = configured.bindings;
  const args = process.argv.slice(2);
  const apply =
    args[0] === "--apply" &&
    args[1] === "--branch" &&
    args[2] === database.branchId &&
    args.length === 3;
  if (!(args.length === 1 && args[0] === "--check") && !apply)
    throw new Error(
      "Use --check or --apply --branch <intended isolated branch ID>.",
    );
  if (!["development", "test"].includes(environment))
    throw new Error(
      "This initial migration command supports isolated development/test branches only.",
    );
  const migration = new URL(process.env.MIGRATION_DATABASE_URL ?? "");
  const runtime = new URL(process.env.DATABASE_URL);
  const ssl = migration.searchParams.getAll("sslmode");
  if (
    !["postgres:", "postgresql:"].includes(migration.protocol) ||
    migration.hostname.includes("-pooler.") ||
    migration.hostname !== runtime.hostname.replace("-pooler.", ".") ||
    migration.pathname !== runtime.pathname ||
    !migration.password ||
    migration.hash ||
    decodeURIComponent(migration.username) === database.runtimeRole ||
    ssl.length !== 1 ||
    !["require", "verify-ca", "verify-full"].includes(ssl[0]) ||
    [...migration.searchParams.keys()].some(
      (key) =>
        ![
          "sslmode",
          "channel_binding",
          "connect_timeout",
          "application_name",
        ].includes(key),
    )
  ) {
    throw new Error(
      "Use the same isolated database's direct endpoint with a separate migration role and TLS.",
    );
  }
  const client = new Client({
    connectionString: migration.href,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    application_name: "treido-migration",
  });
  try {
    await client.connect();
    if (
      (await client.query("SHOW server_encoding")).rows[0].server_encoding !==
      "UTF8"
    )
      throw new Error("The marketplace database must use UTF8.");
    const role = await client.query(
      "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname=$1",
      [database.runtimeRole],
    );
    if (role.rows.length !== 1 || Object.values(role.rows[0]).some(Boolean))
      throw new Error(
        "The declared runtime role must exist without database/role administration privileges.",
      );
    const privileges = await client.query(
      "SELECT has_database_privilege($1,current_database(),'CREATE') AS database_create, has_schema_privilege($1,'public','CREATE') AS public_create",
      [database.runtimeRole],
    );
    if (Object.values(privileges.rows[0]).some(Boolean))
      throw new Error(
        "The runtime role still has database or public-schema creation privileges.",
      );
    console.log(
      JSON.stringify({
        environment,
        projectId: database.projectId,
        branchId: database.branchId,
        database: database.databaseName,
        runtimeRole: database.runtimeRole,
        action: apply ? "apply" : "check",
        note: "Declared target; provider ownership/isolation must already be qualified in T04a.",
      }),
    );
    if (apply) {
      const outcomes = [];
      for (const version of [
        "0001_identity_drafts",
        "0002_seller_setup",
        "0003_durable_jobs",
        "0004_listing_media",
        "0005_category_catalogue",
        "0006_participants_reports",
        "0007_moderation",
        "0008_withdrawal_receipts",
        "0009_product_duplicates",
        "0010_inbox_controls",
        "0011_listing_publications",
      ]) {
        const source = await readFile(
          new URL(`../migrations/${version}.sql`, import.meta.url),
          "utf8",
        );
        outcomes.push({
          version,
          outcome: await applyReviewedMigration(client, version, source),
        });
      }
      await applyRuntimeGrants(client, database.runtimeRole);
      const schema = await client.query(
        "SELECT has_schema_privilege($1,'treido','CREATE') AS can_create",
        [database.runtimeRole],
      );
      if (schema.rows[0].can_create)
        throw new Error(
          "Runtime schema creation remains enabled; role qualification failed.",
        );
      console.log(
        JSON.stringify({ migrations: outcomes, runtimeDataGrants: "applied" }),
      );
    }
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error(
    "Migration did not complete. Check the intended isolated target, roles and reviewed SQL. Credentials and provider errors are not logged.",
  );
  process.exitCode = 1;
});
