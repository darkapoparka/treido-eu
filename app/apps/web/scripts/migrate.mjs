import { Client } from "pg";
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
import { readFile } from "node:fs/promises";
import {
  deriveDevelopmentDatabaseEnvironment,
  validateDatabaseBindings,
} from "../src/server/config/backend-bindings.ts";
import { applyReviewedMigration } from "./identity-draft-migration.mjs";
import { applyRuntimeGrants } from "./runtime-grants.mjs";

async function main() {
  const databaseEnvironment = deriveDevelopmentDatabaseEnvironment(process.env);
  const configured = validateDatabaseBindings(databaseEnvironment);
  if (!configured.ok)
    throw new Error(
      "Set the intended isolated database bindings before running migrations.",
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
  const runtime = new URL(databaseEnvironment.DATABASE_URL);
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
        "0012_buyer_library",
        "0013_inventory_allocations",
        "0014_buyer_cart",
        "0015_structured_offers",
        "0016_catalogue_imports",
        "0017_stock_batches_offer_expiry",
        "0018_team_settings",
        "0019_profile_invitation_decisions",
        "0020_media_retention",
        "0021_purchase_reviews",
        "0022_contact_operations",
        "0023_connected_payments",
        "0024_payment_source_identity",
        "0025_trust_case_decisions",
        "0026_buyer_comparisons",
        "0027_saved_searches",
        "0028_account_privacy_requests",
        "0029_assistant_tools",
        "0030_buyer_gift_finder",
        "0031_seller_billing",
        "0032_seller_promotions",
        "0033_promotion_payment_bridge",
        "0034_assistant_inputs",
        "0035_order_aftercare",
        "0036_order_feedback",
        "0037_account_lifecycle",
        "0038_lifecycle_extensions",
        "0039_lifecycle_jobs",
        "0040_order_shipping",
        "0041_shipping_retention",
        "0042_shipping_financial",
        "0043_shipping_lifecycle",
        "0044_astra_closure_consistency",
        "0045_invitation_mail",
        "0046_message_attachments",
        "0047_billing_change_recovery",
        "0048_message_image_lifecycle",
        "0049_message_image_executor_fence",
        "0050_message_image_dispatch_barrier",
        "0051_assistant_voice_usage",
        "0052_repair_due",
        "0053_category_navigation",
        "0054_seller_declaration_reviews",
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
      await client.query("BEGIN");
      try {
        await applyRuntimeGrants(client, database.runtimeRole);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
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
