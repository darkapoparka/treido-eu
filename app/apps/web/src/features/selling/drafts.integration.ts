import { definePurchaseReviewIntegrationCases } from "../purchase-reviews/integration-cases";
import { definePaymentMaintenanceIntegrationCases } from "../payments/maintenance-integration-cases";
import { defineLaunchIntegrationCases } from "../seller-settings/launch-integration-cases";
import { defineTeamIntegrationCases } from "../team/integration-cases";
import { defineImportIntegrationCases } from "../catalogue-import/integration-cases";
import { defineInventoryIntegrationCases } from "../inventory/integration-cases";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  readFile,
  mkdir,
  mkdtemp,
  appendFile,
  writeFile,
  readdir,
  realpath,
} from "node:fs/promises";
import { resolve, join, basename, relative, parse } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import EmbeddedPostgres from "embedded-postgres";
import { Pool, type Client } from "pg";

vi.mock("server-only", () => ({}));
import {
  createDatabase,
  inTransaction,
  type SellerDatabase,
} from "../../server/db/database";
import {
  authorizeSeller,
  createBusinessSeller,
  ensurePersonalSeller,
  listOwnedSellers,
  revokeSellerMembership,
} from "../sellers/persistence.server";
import {
  createListingDraft,
  listListingDrafts,
  readListingDraft,
  saveListingDraft,
} from "./drafts.server";
import { emptyDraft } from "./draft-model";
import {
  applyIdentityDraftMigration,
  applyReviewedMigration,
} from "../../../scripts/identity-draft-migration.mjs";
import {
  completeSignupIntent,
  readSignupIntent,
  readSellerSetup,
  saveSellerSetup,
  readSellerReadiness,
} from "../sellers/setup.server";
import {
  BUSINESS_SETUP_VERSION,
  emptyDeclaration,
} from "../sellers/setup-model";
import { defineJobIntegrationCases } from "../../server/jobs/integration-cases";
import { defineMediaIntegrationCases } from "./media-integration-cases";
import { applyRuntimeGrants } from "../../../scripts/runtime-grants.mjs";
import {
  assertFixtureHeadroom,
  selectFixtureEvidenceDirectory,
  cleanupLaunchCluster,
} from "../../../../../tests/t72/native-fixture-support.mjs";
import { trackPoolDisconnects } from "../../../../../tests/t72/pool-disconnects.mjs";
import { defineCategoryIntegrationCases } from "../../server/categories/integration-cases";
import { defineParticipantIntegrationCases } from "../messaging/integration-cases";
import { defineInboxIntegrationCases } from "../messaging/inbox-integration-cases";
import * as inboxApi from "../messaging/inbox.server";
import * as conversationApi from "../messaging/participants.server";
import * as reportApi from "../trust/reports.server";
import * as reviewApi from "../trust/moderation.server";
import * as reportViews from "../trust/report-views.server";
import { defineModerationIntegrationCases } from "../trust/integration-cases";
import { definePublicationIntegrationCases } from "./publication-integration-cases";
import { defineDiscoveryIntegrationCases } from "../catalog/discovery-integration-cases";
import { defineLibraryIntegrationCases } from "../library/integration-cases";
import { definePublishIntegrationCases } from "./publish-integration-cases";
import { defineAdminProductIntegrationCases } from "../sellers/admin-products-integration-cases";
import { readAdminProducts } from "../sellers/admin-products.server";
import { defineProductManagementIntegrationCases } from "../sellers/admin-product-management-integration-cases";
import {
  duplicateSellerProduct,
  duplicateSellerProducts,
  withdrawSellerProducts,
} from "../sellers/admin-product-management.server";

const evidence = selectFixtureEvidenceDirectory(
  undefined,
  process.env.TREIDO_DATABASE_EVIDENCE_ROOT,
  resolve(process.cwd(), "../.qa/t04b-drafts-20261001"),
);
const priorDiscoveryKey = process.env.TREIDO_DISCOVERY_CURSOR_KEY;
let cluster: EmbeddedPostgres;
let directory: string;
let pgCtl: string;
let started = false;
const execute = (file: string, args: string[]) =>
  new Promise<void>((done, fail) => {
    // Detached PostgreSQL workers must not inherit a captured pipe and delay the
    // control command's completion. The server writes to its owned log file.
    const child = spawn(file, args, { stdio: "ignore", windowsHide: true });
    child.on("error", fail);
    child.on("exit", (code) =>
      code === 0
        ? done()
        : fail(
            new Error(
              `PostgreSQL control failed (${code}); inspect the owned cluster log.`,
            ),
          ),
    );
  });
let admin: Client;
let database: SellerDatabase;
let drainRuntime: (() => Promise<void>) | undefined;
const migrationEvidence: Array<{ version: string; checksum: string }> = [];
let runtimeConfig: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
};
const identity = (label: string) => ({
  subject: `user_integration_${label}_${randomUUID().replaceAll("-", "")}`,
});
const owner = identity("owner");
const other = identity("other");
let personal: string;
let businessA: string;
let businessB: string;
let otherUserId: string;

beforeAll(async () => {
  if (process.version !== "v24.20.0") throw Error("Pinned Node required");
  assertFixtureHeadroom(evidence);
  process.env.TREIDO_DISCOVERY_CURSOR_KEY = randomBytes(32).toString("hex");
  await mkdir(evidence, { recursive: true });
  directory = await mkdtemp(join(evidence, "postgres-"));
  const exact = await realpath(directory);
  if (
    relative(await realpath(evidence), exact).startsWith("..") ||
    exact === parse(exact).root
  )
    throw Error("Unsafe isolated cluster path");
  const temp = join(evidence, "temp");
  await mkdir(temp, { recursive: true });
  process.env.TEMP = temp;
  process.env.TMP = temp;
  const logPath = join(evidence, `${basename(directory)}.log`);
  const port = await new Promise<number>((done, fail) => {
    const server = createServer();
    server.on("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return fail(new Error("No isolated port"));
      server.close(() => done(address.port));
    });
  });
  if ([6412, 6413, 6418, 6419].includes(port))
    throw Error("Protected preview port selected");
  cluster = new EmbeddedPostgres({
    databaseDir: directory,
    port,
    user: "postgres",
    password: randomBytes(24).toString("hex"),
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1", "-c", "max_connections=20"],
    onLog: (message) => {
      void appendFile(logPath, `${message}\n`);
    },
    onError: (message) => {
      void appendFile(logPath, `${String(message)}\n`);
    },
  });
  const fromEmbedded = createRequire(
    createRequire(import.meta.url).resolve("embedded-postgres"),
  );
  const binaryPackage = `@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`;
  pgCtl = (fromEmbedded(binaryPackage) as { pg_ctl: string }).pg_ctl;
  await cluster.initialise();
  // pg_ctl performs a graceful shutdown on Windows, including PostgreSQL 18's
  // I/O workers. embedded-postgres.stop() uses a force-kill there.
  await execute(pgCtl, [
    "start",
    "-D",
    directory,
    "-l",
    logPath,
    "-o",
    `-h 127.0.0.1 -p ${port} -c max_connections=20`,
    "-w",
    "-t",
    "30",
  ]);
  started = true;
  const bootstrap = cluster.getPgClient("postgres", "127.0.0.1");
  await bootstrap.connect();
  try {
    await bootstrap.query(
      "CREATE DATABASE treido_integration WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'",
    );
  } finally {
    await bootstrap.end();
  }
  admin = cluster.getPgClient("treido_integration", "127.0.0.1");
  await admin.connect();
  expect(
    (await admin.query("SHOW server_encoding")).rows[0].server_encoding,
  ).toBe("UTF8");
  const migration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0001_identity_drafts.sql"),
    "utf8",
  );
  expect(await applyIdentityDraftMigration(admin, migration)).toBe("applied");
  expect(await applyIdentityDraftMigration(admin, migration)).toBe(
    "already-applied",
  );
  await expect(
    applyIdentityDraftMigration(admin, migration + "\n-- changed"),
  ).rejects.toThrow("checksum differs");
  // Empty, freshly created local schema only. Preserve the cluster/evidence.
  await admin.query(
    "DROP SCHEMA treido CASCADE; DROP TABLE public.treido_schema_migrations",
  );
  await expect(
    applyIdentityDraftMigration(admin, migration + "\nSELECT 1/0;"),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (
      await admin.query(
        "SELECT to_regnamespace('treido') AS schema, to_regclass('public.treido_schema_migrations') AS receipt",
      )
    ).rows[0],
  ).toEqual({ schema: null, receipt: null });
  await applyIdentityDraftMigration(admin, migration);
  const setupMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0002_seller_setup.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0002_seller_setup",
      setupMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (
      await admin.query(
        "SELECT to_regclass('treido.seller_onboarding_progress') AS setup, to_regclass('treido.seller_declarations') AS declarations",
      )
    ).rows[0],
  ).toEqual({ setup: null, declarations: null });
  expect(
    await applyReviewedMigration(admin, "0002_seller_setup", setupMigration),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(admin, "0002_seller_setup", setupMigration),
  ).toBe("already-applied");
  await expect(
    applyReviewedMigration(
      admin,
      "0002_seller_setup",
      setupMigration + "\n-- changed",
    ),
  ).rejects.toThrow("checksum differs");
  const password = randomBytes(24).toString("hex");
  const jobMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0003_durable_jobs.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0003_durable_jobs",
      jobMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (await admin.query("SELECT to_regclass('treido.outbox_jobs') AS jobs"))
      .rows[0].jobs,
  ).toBeNull();
  expect(
    await applyReviewedMigration(admin, "0003_durable_jobs", jobMigration),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(admin, "0003_durable_jobs", jobMigration),
  ).toBe("already-applied");
  await expect(
    applyReviewedMigration(
      admin,
      "0003_durable_jobs",
      jobMigration + "\n-- changed",
    ),
  ).rejects.toThrow("checksum differs");
  const mediaMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0004_listing_media.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0004_listing_media",
      mediaMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (await admin.query("SELECT to_regclass('treido.media_assets') AS media"))
      .rows[0].media,
  ).toBeNull();
  expect(
    await applyReviewedMigration(admin, "0004_listing_media", mediaMigration),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(admin, "0004_listing_media", mediaMigration),
  ).toBe("already-applied");
  const categoryMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0005_category_catalogue.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0005_category_catalogue",
      categoryMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (await admin.query("SELECT to_regclass('treido.categories') AS categories"))
      .rows[0].categories,
  ).toBeNull();
  expect(
    await applyReviewedMigration(
      admin,
      "0005_category_catalogue",
      categoryMigration,
    ),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(
      admin,
      "0005_category_catalogue",
      categoryMigration,
    ),
  ).toBe("already-applied");
  await expect(
    applyReviewedMigration(
      admin,
      "0005_category_catalogue",
      categoryMigration + "\n-- changed",
    ),
  ).rejects.toThrow("checksum differs");
  const participantMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0006_participants_reports.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0006_participants_reports",
      participantMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (
      await admin.query(
        "SELECT to_regclass('treido.conversation_threads') AS threads",
      )
    ).rows[0].threads,
  ).toBeNull();
  expect(
    await applyReviewedMigration(
      admin,
      "0006_participants_reports",
      participantMigration,
    ),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(
      admin,
      "0006_participants_reports",
      participantMigration,
    ),
  ).toBe("already-applied");
  const moderationMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0007_moderation.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0007_moderation",
      moderationMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (
      await admin.query(
        "SELECT to_regclass('treido.moderation_actions') AS actions",
      )
    ).rows[0].actions,
  ).toBeNull();
  expect(
    await applyReviewedMigration(admin, "0007_moderation", moderationMigration),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(admin, "0007_moderation", moderationMigration),
  ).toBe("already-applied");
  await admin.query(
    `CREATE ROLE treido_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
  );
  await admin.query(
    "GRANT USAGE ON SCHEMA treido TO treido_runtime; GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA treido TO treido_runtime; REVOKE CREATE ON SCHEMA public FROM PUBLIC",
  );
  await admin.query(
    "REVOKE UPDATE ON treido.seller_declarations, treido.seller_setup_receipts, treido.job_redrives FROM treido_runtime",
  );
  const withdrawalMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0008_withdrawal_receipts.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0008_withdrawal_receipts",
      withdrawalMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (
      await admin.query(
        "SELECT to_regclass('treido.listing_withdrawal_receipts') AS receipts",
      )
    ).rows[0].receipts,
  ).toBeNull();
  expect(
    await applyReviewedMigration(
      admin,
      "0008_withdrawal_receipts",
      withdrawalMigration,
    ),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(
      admin,
      "0008_withdrawal_receipts",
      withdrawalMigration,
    ),
  ).toBe("already-applied");
  await expect(
    applyReviewedMigration(
      admin,
      "0008_withdrawal_receipts",
      withdrawalMigration + "\n-- changed",
    ),
  ).rejects.toThrow("checksum differs");
  const duplicateMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0009_product_duplicates.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0009_product_duplicates",
      duplicateMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (
      await admin.query(
        "SELECT to_regclass('treido.listing_duplicate_receipts') AS receipts",
      )
    ).rows[0].receipts,
  ).toBeNull();
  expect(
    await applyReviewedMigration(
      admin,
      "0009_product_duplicates",
      duplicateMigration,
    ),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(
      admin,
      "0009_product_duplicates",
      duplicateMigration,
    ),
  ).toBe("already-applied");
  await expect(
    applyReviewedMigration(
      admin,
      "0009_product_duplicates",
      duplicateMigration + "\n-- changed",
    ),
  ).rejects.toThrow("checksum differs");
  const inboxMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0010_inbox_controls.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0010_inbox_controls",
      inboxMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (
      await admin.query(
        "SELECT to_regclass('treido.contact_preferences') AS value",
      )
    ).rows[0].value,
  ).toBeNull();
  expect(
    await applyReviewedMigration(admin, "0010_inbox_controls", inboxMigration),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(admin, "0010_inbox_controls", inboxMigration),
  ).toBe("already-applied");
  const publicationSnapshotSql = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0011_listing_publications.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0011_listing_publications",
      publicationSnapshotSql + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (
      await admin.query(
        "SELECT to_regclass('treido.listing_publications') AS value",
      )
    ).rows[0].value,
  ).toBeNull();
  expect(
    await applyReviewedMigration(
      admin,
      "0011_listing_publications",
      publicationSnapshotSql,
    ),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(
      admin,
      "0011_listing_publications",
      publicationSnapshotSql,
    ),
  ).toBe("already-applied");
  const libraryMigration = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0012_buyer_library.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0012_buyer_library",
      libraryMigration + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (await admin.query("SELECT to_regclass('treido.buyer_libraries') AS value"))
      .rows[0].value,
  ).toBeNull();
  expect(
    await applyReviewedMigration(admin, "0012_buyer_library", libraryMigration),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(admin, "0012_buyer_library", libraryMigration),
  ).toBe("already-applied");
  for (const version of [
    "0013_inventory_allocations",
    "0014_buyer_cart",
    "0015_structured_offers",
  ]) {
    const source = await readFile(
      resolve(process.cwd(), `apps/web/migrations/${version}.sql`),
      "utf8",
    );
    await expect(
      applyReviewedMigration(admin, version, source + "\nSELECT 1/0;"),
    ).rejects.toMatchObject({ code: "22012" });
    expect(await applyReviewedMigration(admin, version, source)).toBe(
      "applied",
    );
    expect(await applyReviewedMigration(admin, version, source)).toBe(
      "already-applied",
    );
  }
  const importSql = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0016_catalogue_imports.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0016_catalogue_imports",
      importSql + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    (
      await admin.query(
        "SELECT to_regclass('treido.catalogue_imports') AS value",
      )
    ).rows[0].value,
  ).toBeNull();
  expect(
    await applyReviewedMigration(admin, "0016_catalogue_imports", importSql),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(admin, "0016_catalogue_imports", importSql),
  ).toBe("already-applied");
  const stockBatchSql = await readFile(
    resolve(
      process.cwd(),
      "apps/web/migrations/0017_stock_batches_offer_expiry.sql",
    ),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0017_stock_batches_offer_expiry",
      stockBatchSql + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    await applyReviewedMigration(
      admin,
      "0017_stock_batches_offer_expiry",
      stockBatchSql,
    ),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(
      admin,
      "0017_stock_batches_offer_expiry",
      stockBatchSql,
    ),
  ).toBe("already-applied");
  const teamSql = await readFile(
    resolve(process.cwd(), "apps/web/migrations/0018_team_settings.sql"),
    "utf8",
  );
  await expect(
    applyReviewedMigration(
      admin,
      "0018_team_settings",
      teamSql + "\nSELECT 1/0;",
    ),
  ).rejects.toMatchObject({ code: "22012" });
  expect(
    await applyReviewedMigration(admin, "0018_team_settings", teamSql),
  ).toBe("applied");
  expect(
    await applyReviewedMigration(admin, "0018_team_settings", teamSql),
  ).toBe("already-applied");
  for (const version of [
    "0019_profile_invitation_decisions",
    "0020_media_retention",
    "0021_purchase_reviews",
    "0022_contact_operations",
  ]) {
    const source = await readFile(
      resolve(process.cwd(), `apps/web/migrations/${version}.sql`),
      "utf8",
    );
    await expect(
      applyReviewedMigration(admin, version, source + "\nSELECT 1/0;"),
    ).rejects.toMatchObject({ code: "22012" });
    expect(await applyReviewedMigration(admin, version, source)).toBe(
      "applied",
    );
    expect(await applyReviewedMigration(admin, version, source)).toBe(
      "already-applied",
    );
  }
  // Retain the original rollback/replay assertions above, then exercise the
  // current canonical schema and grants on this fresh owned loopback target.
  const runner = await readFile(
    resolve(process.cwd(), "apps/web/scripts/migrate.mjs"),
    "utf8",
  );
  const literal = runner.match(
    /for\s*\(const version of\s*(\[[\s\S]*?\])\s*\)/,
  )?.[1];
  if (
    !literal ||
    literal
      .slice(1, -1)
      .replace(/"\d{4}_[a-z_]+"/g, "")
      .replace(/[\s,]/g, "") !== ""
  )
    throw Error("Canonical migration sequence is not literal");
  const canonical = [...literal.matchAll(/"(\d{4}_[a-z_]+)"/g)].map(
    (match) => match[1],
  );
  const files = (await readdir(resolve(process.cwd(), "apps/web/migrations")))
    .filter((file) => /^\d{4}_[a-z_]+\.sql$/.test(file))
    .sort();
  expect(canonical.map((version) => version + ".sql")).toEqual(files);
  expect(
    canonical.every(
      (version, index) => Number(version.slice(0, 4)) === index + 1,
    ),
  ).toBe(true);
  for (const version of canonical) {
    const source = await readFile(
      resolve(process.cwd(), `apps/web/migrations/${version}.sql`),
      "utf8",
    );
    const checksum = createHash("sha256").update(source).digest("hex");
    expect(await applyReviewedMigration(admin, version, source)).toBe(
      Number(version.slice(0, 4)) <= 22 ? "already-applied" : "applied",
    );
    expect(await applyReviewedMigration(admin, version, source)).toBe(
      "already-applied",
    );
    migrationEvidence.push({ version, checksum });
  }
  expect(
    (
      await admin.query(
        "SELECT version,checksum FROM public.treido_schema_migrations ORDER BY version",
      )
    ).rows,
  ).toEqual(migrationEvidence);
  await applyRuntimeGrants(admin, "treido_runtime");
  runtimeConfig = {
    host: "127.0.0.1",
    port,
    database: "treido_integration",
    user: "treido_runtime",
    password,
    max: 5,
  };
  const runtimePool = new Pool({
    ...runtimeConfig,
    connectionTimeoutMillis: 3000,
    statement_timeout: 12000,
    idle_in_transaction_session_timeout: 12000,
  });
  drainRuntime = trackPoolDisconnects(runtimePool);
  database = createDatabase(runtimePool);
  personal = await ensurePersonalSeller(database, owner);
  businessA = await createBusinessSeller(database, owner, {
    name: "Business A",
    requestId: randomUUID(),
  });
  businessB = await createBusinessSeller(database, owner, {
    name: "Business B",
    requestId: randomUUID(),
  });
  await ensurePersonalSeller(database, other);
  otherUserId = (
    await admin.query<{ id: string }>(
      "SELECT id FROM treido.users WHERE clerk_subject = $1",
      [other.subject],
    )
  ).rows[0].id;
  const version = (
    await admin.query<{ version: string }>("SELECT version() AS version")
  ).rows[0].version;
  await writeFile(
    join(evidence, "database-target.json"),
    JSON.stringify(
      {
        engine: version,
        target: "Fresh owned native loopback cluster",
        directory,
        port,
        database: "treido_integration",
        runtimeRole: "treido_runtime",
        migrations: migrationEvidence,
        migrationRollback: "PASS on empty owned schema",
        setupMigration:
          "Transactional failed migration rollback, apply, checksum replay and mismatch denial PASS",
        subjects: "Synthetic verified-identity inputs; not live Clerk sign-in",
      },
      null,
      2,
    ),
  );
});

describe("real PostgreSQL resumable business setup and human intent", () => {
  const owner = identity("setup_owner");
  const freshBusiness = () =>
    createBusinessSeller(database, owner, {
      name: "Setup business",
      requestId: randomUUID(),
    });
  const declaration = {
    ...emptyDeclaration,
    legalName: "Example Trader Ltd",
    registrationNumber: "123456789",
    contactEmail: "trader@example.test",
    contactAddress: "1 Example Street, Sofia",
    accurate: true,
  };
  const profile = {
    name: "Магазин София",
    description: "Описание на бизнеса",
    locality: "София",
  };
  it("GET-equivalent intent/setup/readiness queries create no records", async () => {
    const sellerId = await freshBusiness();
    const counts = async () =>
      (
        await admin.query(
          "SELECT (SELECT count(*) FROM treido.users) AS users, (SELECT count(*) FROM treido.signup_intents) AS intents, (SELECT count(*) FROM treido.seller_onboarding_progress) AS progress, (SELECT count(*) FROM treido.seller_declarations) AS declarations",
        )
      ).rows[0];
    const before = await counts();
    expect(
      await readSignupIntent(database, identity("unregistered_intent")),
    ).toEqual({ intent: null, revision: 0 });
    expect((await readSellerSetup(database, owner, sellerId)).revision).toBe(0);
    await readSellerReadiness(database, owner, sellerId);
    expect(await counts()).toEqual(before);
  });
  it("skip/change intent survives another connection without creating or converting sellers", async () => {
    const human = identity("intent");
    const input = {
      intent: null,
      expectedRevision: 0,
      requestId: randomUUID(),
    };
    expect(await completeSignupIntent(database, human, input)).toEqual({
      intent: null,
      revision: 1,
    });
    expect(await completeSignupIntent(database, human, input)).toEqual({
      intent: null,
      revision: 1,
    });
    await completeSignupIntent(database, human, {
      intent: "business",
      expectedRevision: 1,
      requestId: randomUUID(),
    });
    const fresh = createDatabase(new Pool(runtimeConfig));
    try {
      expect(await readSignupIntent(fresh, human)).toEqual({
        intent: "business",
        revision: 2,
      });
      expect(await listOwnedSellers(fresh, human)).toEqual([]);
    } finally {
      await fresh.pool.end();
    }
    await expect(
      completeSignupIntent(database, human, input),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await readSignupIntent(database, other)).toEqual({
      intent: null,
      revision: 0,
    });
    await admin.query(
      "UPDATE treido.users SET status='restricted' WHERE clerk_subject=$1",
      [human.subject],
    );
    await expect(readSignupIntent(database, human)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      completeSignupIntent(database, human, {
        intent: "buy",
        expectedRevision: 2,
        requestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("public details and an incomplete declaration resume across sessions/connections", async () => {
    const sellerId = await freshBusiness();
    const saved = await saveSellerSetup(database, owner, {
      sellerId,
      expectedRevision: 0,
      requestId: randomUUID(),
      section: "details",
      submit: false,
      payload: profile,
    });
    expect(saved).toMatchObject({ revision: 1, step: "declaration" });
    await saveSellerSetup(database, owner, {
      sellerId,
      expectedRevision: 1,
      requestId: randomUUID(),
      section: "declaration",
      submit: false,
      payload: { ...emptyDeclaration, legalName: "Partial Ltd" },
    });
    const fresh = createDatabase(new Pool(runtimeConfig));
    try {
      const view = await readSellerSetup(fresh, owner, sellerId);
      expect(view).toMatchObject({
        revision: 2,
        lastStep: "declaration",
        profile,
        declarationStatus: "required",
        declaration: { legalName: "Partial Ltd", contactEmail: "" },
      });
    } finally {
      await fresh.pool.end();
    }
    expect(
      (await readSellerSetup(database, owner, await freshBusiness())).profile
        .description,
    ).toBe("");
  });
  it("submission requests review, and retries neither duplicate snapshots nor grant trading", async () => {
    const sellerId = await freshBusiness();
    const input = {
      sellerId,
      expectedRevision: 0,
      requestId: randomUUID(),
      section: "declaration" as const,
      submit: true,
      payload: declaration,
    };
    const accepted = await saveSellerSetup(database, owner, input);
    expect(await saveSellerSetup(database, owner, input)).toEqual(accepted);
    const view = await readSellerSetup(database, owner, sellerId);
    expect(view).toMatchObject({
      lastStep: "review",
      revision: 1,
      declarationStatus: "review_required",
    });
    expect(JSON.stringify(accepted)).not.toContain(declaration.contactEmail);
    expect(
      (
        await database.pool.query(
          "SELECT count(*) FROM treido.seller_declarations WHERE seller_id=$1",
          [sellerId],
        )
      ).rows[0].count,
    ).toBe("1");
    const operations = await readSellerReadiness(database, owner, sellerId);
    expect(operations.find((row) => row.operation === "draft")?.status).toBe(
      "allowed",
    );
    for (const operation of ["publish", "checkout", "payout"])
      expect(
        operations.find((row) => row.operation === operation)?.status,
      ).toBe("blocked");
    await expect(
      saveSellerSetup(database, owner, {
        ...input,
        payload: { ...declaration, legalName: "Changed" },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("required declaration fields and client-authored approval cannot bypass submission", async () => {
    const sellerId = await freshBusiness();
    for (const payload of [
      emptyDeclaration,
      { ...declaration, accurate: false },
      { ...declaration, status: "accepted" },
      { ...declaration, requirementVersion: 999 },
    ]) {
      await expect(
        saveSellerSetup(database, owner, {
          sellerId,
          expectedRevision: 0,
          requestId: randomUUID(),
          section: "declaration",
          submit: true,
          payload,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    expect((await readSellerSetup(database, owner, sellerId)).revision).toBe(0);
  });
  it("changed declarations append a new snapshot and reopen readiness", async () => {
    const sellerId = await freshBusiness();
    await saveSellerSetup(database, owner, {
      sellerId,
      expectedRevision: 0,
      requestId: randomUUID(),
      section: "declaration",
      submit: true,
      payload: declaration,
    });
    // Synthetic operator review in this isolated test, not a real approval claim.
    await admin.query(
      "UPDATE treido.seller_declarations SET status='accepted' WHERE seller_id=$1",
      [sellerId],
    );
    expect(
      (await readSellerSetup(database, owner, sellerId)).declarationStatus,
    ).toBe("current");
    await admin.query(
      "UPDATE treido.seller_declarations SET requirement_version=$2 WHERE seller_id=$1",
      [sellerId, BUSINESS_SETUP_VERSION + 1],
    );
    expect(
      (await readSellerSetup(database, owner, sellerId)).declarationStatus,
    ).toBe("stale");
    await saveSellerSetup(database, owner, {
      sellerId,
      expectedRevision: 1,
      requestId: randomUUID(),
      section: "declaration",
      submit: false,
      payload: { ...declaration, contactEmail: "new@example.test" },
    });
    expect(
      (await readSellerSetup(database, owner, sellerId)).declarationStatus,
    ).toBe("required");
    expect(
      (
        await admin.query(
          "SELECT contact_email, status FROM treido.seller_declarations WHERE seller_id=$1 ORDER BY revision",
          [sellerId],
        )
      ).rows,
    ).toEqual([
      { contact_email: declaration.contactEmail, status: "accepted" },
      { contact_email: "new@example.test", status: "draft" },
    ]);
  });
  it("simultaneous first saves compare revisions under actual PostgreSQL locks", async () => {
    const sellerId = await freshBusiness();
    await admin.query("BEGIN");
    await admin.query(
      "SELECT id FROM treido.seller_accounts WHERE id=$1 FOR UPDATE",
      [sellerId],
    );
    const pending = Promise.allSettled(
      ["One", "Two"].map((name) =>
        saveSellerSetup(database, owner, {
          sellerId,
          expectedRevision: 0,
          requestId: randomUUID(),
          section: "details",
          submit: false,
          payload: { ...profile, name },
        }),
      ),
    );
    try {
      await waitForBlockedAuthority("seller_accounts", 2);
    } finally {
      await admin.query("COMMIT");
    }
    const results = await pending;
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(
      results
        .filter((row) => row.status === "rejected")
        .map((row) => row.reason.code),
    ).toEqual(["CONFLICT"]);
    const saved = await readSellerSetup(database, owner, sellerId);
    expect(saved.revision).toBe(1);
    expect(["One", "Two"]).toContain(saved.profile.name);
  });
  it("duplicate concurrent setup submissions are one write and an old replay cannot acknowledge newer data", async () => {
    const sellerId = await freshBusiness();
    const input = {
      sellerId,
      expectedRevision: 0,
      requestId: randomUUID(),
      section: "details" as const,
      submit: false,
      payload: profile,
    };
    const [a, b] = await Promise.all([
      saveSellerSetup(database, owner, input),
      saveSellerSetup(database, owner, input),
    ]);
    expect(a).toEqual(b);
    await saveSellerSetup(database, owner, {
      ...input,
      expectedRevision: 1,
      requestId: randomUUID(),
      payload: { ...profile, name: "Newer name" },
    });
    await expect(saveSellerSetup(database, owner, input)).rejects.toMatchObject(
      { code: "CONFLICT" },
    );
    expect(
      (await readSellerSetup(database, owner, sellerId)).profile.name,
    ).toBe("Newer name");
  });
  it("independent users and manager capabilities isolate private declarations", async () => {
    const sellerId = await freshBusiness();
    await saveSellerSetup(database, owner, {
      sellerId,
      expectedRevision: 0,
      requestId: randomUUID(),
      section: "declaration",
      submit: true,
      payload: declaration,
    });
    await expect(
      readSellerSetup(database, other, sellerId),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await admin.query(
      "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'manager','[]')",
      [sellerId, otherUserId],
    );
    const view = await readSellerSetup(database, other, sellerId);
    expect(view.declaration).toBeNull();
    expect(view.canEditDeclaration).toBe(false);
    expect(JSON.stringify(view)).not.toContain(declaration.contactEmail);
    await expect(
      saveSellerSetup(database, other, {
        sellerId,
        expectedRevision: 1,
        requestId: randomUUID(),
        section: "declaration",
        submit: false,
        payload: declaration,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveSellerSetup(database, other, {
        sellerId,
        expectedRevision: 1,
        requestId: randomUUID(),
        section: "details",
        submit: false,
        payload: profile,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await admin.query(
      "UPDATE treido.seller_memberships SET grants='[\"profile.manage\"]' WHERE seller_id=$1 AND user_id=$2",
      [sellerId, otherUserId],
    );
    await saveSellerSetup(database, other, {
      sellerId,
      expectedRevision: 1,
      requestId: randomUUID(),
      section: "details",
      submit: false,
      payload: profile,
    });
    expect(
      (await readSellerSetup(database, other, sellerId)).declaration,
    ).toBeNull();
  });
  it("revocation waits for authorised setup and denies subsequent reads/writes/replays", async () => {
    const sellerId = await freshBusiness();
    await admin.query(
      "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'manager','[\"profile.manage\"]')",
      [sellerId, otherUserId],
    );
    const input = {
      sellerId,
      expectedRevision: 0,
      requestId: randomUUID(),
      section: "details" as const,
      submit: false,
      payload: profile,
    };
    await saveSellerSetup(database, other, input);
    let removal: Promise<void> | undefined;
    await inTransaction(database, async (tx) => {
      await authorizeSeller(tx, other, sellerId, "profile.manage", true);
      removal = revokeSellerMembership(database, owner, {
        sellerId,
        userId: otherUserId,
      });
      await waitForBlockedAuthority("seller_accounts", 1);
    });
    await removal;
    await expect(
      readSellerSetup(database, other, sellerId),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      readSellerReadiness(database, other, sellerId),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveSellerSetup(database, other, input)).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );
    expect((await readSellerSetup(database, owner, sellerId)).profile).toEqual(
      profile,
    );
  });
  it("runtime cannot update declaration snapshots or attach business setup to a personal seller", async () => {
    await expect(
      database.pool.query(
        "UPDATE treido.seller_declarations SET legal_name='Changed'",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      database.pool.query(
        "UPDATE treido.seller_setup_receipts SET accepted_revision=100",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      database.pool.query(
        "INSERT INTO treido.seller_onboarding_progress(seller_id,revision,last_step) VALUES($1,1,'details')",
        [personal],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      saveSellerSetup(database, owner, {
        sellerId: personal,
        expectedRevision: 0,
        requestId: randomUUID(),
        section: "details",
        submit: false,
        payload: profile,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("a setup write failure rolls back profile, progress and receipt together", async () => {
    const sellerId = await freshBusiness();
    await admin.query(
      "CREATE FUNCTION treido.fail_setup_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic setup failure'; END $$; CREATE TRIGGER fail_setup_test BEFORE INSERT ON treido.seller_onboarding_progress FOR EACH ROW EXECUTE FUNCTION treido.fail_setup_test()",
    );
    try {
      await expect(
        saveSellerSetup(database, owner, {
          sellerId,
          expectedRevision: 0,
          requestId: randomUUID(),
          section: "details",
          submit: false,
          payload: profile,
        }),
      ).rejects.toThrow();
    } finally {
      await admin.query(
        "DROP TRIGGER fail_setup_test ON treido.seller_onboarding_progress; DROP FUNCTION treido.fail_setup_test()",
      );
    }
    expect(await readSellerSetup(database, owner, sellerId)).toMatchObject({
      revision: 0,
      profile: { name: "Setup business", description: "", locality: "" },
    });
    expect(database.pool.waitingCount).toBe(0);
  });
});
afterAll(async () => {
  try {
    await cleanupLaunchCluster({
      drains: [drainRuntime, admin ? () => admin.end() : undefined].filter(
        (drain): drain is () => Promise<void> => Boolean(drain),
      ),
      stop: started
        ? () =>
            execute(pgCtl, [
              "stop",
              "-D",
              directory,
              "-m",
              "fast",
              "-w",
              "-t",
              "60",
            ])
        : undefined,
      recordStopped: async () => {
        started = false;
        await writeFile(
          join(directory, "fixture-stopped.json"),
          JSON.stringify({ stopped: true }),
        );
      },
    });
  } finally {
    if (priorDiscoveryKey === undefined)
      delete process.env.TREIDO_DISCOVERY_CURSOR_KEY;
    else process.env.TREIDO_DISCOVERY_CURSOR_KEY = priorDiscoveryKey;
  }
});

async function waitForBlockedAuthority(table: string, minimum: number) {
  const observer = cluster.getPgClient("treido_integration", "127.0.0.1");
  await observer.connect();
  try {
    const deadline = Date.now() + 3500;
    while (Date.now() < deadline) {
      const waiting = await observer.query<{ count: string }>(
        "SELECT count(*) FROM pg_stat_activity WHERE usename='treido_runtime' AND wait_event_type='Lock' AND query LIKE $1",
        [`%FROM treido.${table}%FOR UPDATE%`],
      );
      if (Number(waiting.rows[0].count) >= minimum) return;
      await setTimeout(10);
    }
    throw new Error(
      `Did not observe ${minimum} real PostgreSQL lock waiters on ${table}.`,
    );
  } finally {
    await observer.end();
  }
}

describe("real PostgreSQL seller/draft persistence", () => {
  it("read-only workspace/editor queries create no records", async () => {
    const counts = async () =>
      (
        await admin.query(
          "SELECT (SELECT count(*) FROM treido.users) AS users, (SELECT count(*) FROM treido.seller_accounts) AS sellers, (SELECT count(*) FROM treido.listing_drafts) AS drafts",
        )
      ).rows[0];
    const before = await counts();
    expect(
      await listOwnedSellers(database, identity("unregistered_reader")),
    ).toEqual([]);
    await listOwnedSellers(database, owner);
    await listListingDrafts(database, owner, businessA);
    expect(await counts()).toEqual(before);
  });
  it("a failure after first-save ownership writes rolls back the whole operation", async () => {
    const human = identity("rollback_first_save");
    await admin.query(
      "CREATE FUNCTION treido.fail_draft_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic insertion failure'; END $$; CREATE TRIGGER fail_draft_test BEFORE INSERT ON treido.listing_drafts FOR EACH ROW EXECUTE FUNCTION treido.fail_draft_test()",
    );
    try {
      await expect(
        createListingDraft(database, human, {
          sellerId: null,
          requestId: randomUUID(),
          payload: emptyDraft,
        }),
      ).rejects.toThrow();
      expect(
        (
          await admin.query(
            "SELECT count(*) FROM treido.users WHERE clerk_subject=$1",
            [human.subject],
          )
        ).rows[0].count,
      ).toBe("0");
    } finally {
      await admin.query(
        "DROP TRIGGER fail_draft_test ON treido.listing_drafts; DROP FUNCTION treido.fail_draft_test()",
      );
    }
    expect(await listOwnedSellers(database, human)).toEqual([]);
  });
  it("concurrent personal entry creates one user/owner/seller", async () => {
    const human = identity("concurrent");
    const result = await Promise.all(
      Array.from({ length: 4 }, () => ensurePersonalSeller(database, human)),
    );
    expect(new Set(result).size).toBe(1);
    const rows = await admin.query<{ count: string }>(
      "SELECT count(*) FROM treido.personal_seller_owners o JOIN treido.users u ON u.id=o.user_id WHERE u.clerk_subject=$1",
      [human.subject],
    );
    expect(rows.rows[0].count).toBe("1");
  });
  it("a human operates a personal seller and two different businesses", async () => {
    const owned = await listOwnedSellers(database, owner);
    expect(owned.map((row) => row.sellerId).sort()).toEqual(
      [personal, businessA, businessB].sort(),
    );
    expect(JSON.stringify(owned)).not.toContain(owner.subject);
    expect(
      (await listOwnedSellers(database, other)).map((row) => row.sellerId),
    ).not.toContain(businessA);
  });
  it("business creation and retry persist one owner and reject changed input", async () => {
    const requestId = randomUUID();
    const input = { name: "Retry business", requestId };
    const result = await Promise.all([
      createBusinessSeller(database, owner, input),
      createBusinessSeller(database, owner, input),
    ]);
    expect(result[0]).toBe(result[1]);
    expect(
      (
        await admin.query(
          "SELECT role FROM treido.seller_memberships WHERE seller_id=$1",
          [result[0]],
        )
      ).rows,
    ).toEqual([{ role: "owner" }]);
    await expect(
      createBusinessSeller(database, owner, {
        name: "Changed name",
        requestId,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("first save creates the personal seller and durable draft atomically", async () => {
    const human = identity("firstsave");
    const created = await createListingDraft(database, human, {
      sellerId: null,
      requestId: randomUUID(),
      payload: { ...emptyDraft, title: "First actual item", priceMinor: 1234 },
    });
    expect(
      (await readListingDraft(database, human, created.sellerId, created.id))
        .payload,
    ).toMatchObject({
      title: "First actual item",
      priceMinor: 1234,
      currency: "EUR",
    });
    expect((await listOwnedSellers(database, human))[0].sellerId).toBe(
      created.sellerId,
    );
  });
  it("duplicate create consumes one slot; different payload conflicts", async () => {
    const input = {
      sellerId: businessA,
      requestId: randomUUID(),
      payload: { ...emptyDraft, title: "Desk" },
    };
    const [a, b] = await Promise.all([
      createListingDraft(database, owner, input),
      createListingDraft(database, owner, input),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      (
        await admin.query(
          "SELECT draft_count FROM treido.seller_usage WHERE seller_id=$1",
          [businessA],
        )
      ).rows[0].draft_count,
    ).toBe(1);
    await expect(
      createListingDraft(database, owner, {
        ...input,
        payload: { ...emptyDraft, title: "Another desk" },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("revisions survive new connections; simultaneous edits preserve the winning value", async () => {
    const item = await createListingDraft(database, owner, {
      sellerId: personal,
      requestId: randomUUID(),
      payload: emptyDraft,
    });
    const change = (title: string) =>
      saveListingDraft(database, owner, {
        sellerId: personal,
        draftId: item.id,
        expectedRevision: 1,
        requestId: randomUUID(),
        payload: { ...emptyDraft, title },
      });
    const writes = await Promise.allSettled([change("One"), change("Two")]);
    expect(writes.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(
      writes
        .filter((row) => row.status === "rejected")
        .map((row) => row.reason.code),
    ).toEqual(["CONFLICT"]);
    const fresh = createDatabase(new Pool(runtimeConfig));
    try {
      const read = await readListingDraft(fresh, owner, personal, item.id);
      expect(read.revision).toBe(2);
      expect(["One", "Two"]).toContain(read.payload.title);
    } finally {
      await fresh.pool.end();
    }
  });
  it("save replay is idempotent and an old replay cannot overwrite a later revision", async () => {
    const item = await createListingDraft(database, owner, {
      sellerId: personal,
      requestId: randomUUID(),
      payload: emptyDraft,
    });
    const command = {
      sellerId: personal,
      draftId: item.id,
      expectedRevision: 1,
      requestId: randomUUID(),
      payload: { ...emptyDraft, title: "Saved" },
    };
    const accepted = await saveListingDraft(database, owner, command);
    expect(await saveListingDraft(database, owner, command)).toEqual(accepted);
    await saveListingDraft(database, owner, {
      ...command,
      expectedRevision: 2,
      requestId: randomUUID(),
      payload: { ...emptyDraft, title: "Newer" },
    });
    await expect(
      saveListingDraft(database, owner, command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      (await readListingDraft(database, owner, personal, item.id)).payload
        .title,
    ).toBe("Newer");
  });
  it("a create retry does not acknowledge old input after the draft was edited", async () => {
    const command = {
      sellerId: businessA,
      requestId: randomUUID(),
      payload: { ...emptyDraft, title: "Original" },
    };
    const item = await createListingDraft(database, owner, command);
    await saveListingDraft(database, owner, {
      sellerId: businessA,
      draftId: item.id,
      expectedRevision: 1,
      requestId: randomUUID(),
      payload: { ...emptyDraft, title: "Current" },
    });
    await expect(
      createListingDraft(database, owner, command),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      (await readListingDraft(database, owner, businessA, item.id)).payload
        .title,
    ).toBe("Current");
  });
  it("foreign people/seller IDs cannot read, save or replay a private draft", async () => {
    const input = {
      sellerId: businessA,
      requestId: randomUUID(),
      payload: emptyDraft,
    };
    const item = await createListingDraft(database, owner, input);
    await expect(
      readListingDraft(database, other, businessA, item.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      readListingDraft(database, owner, businessB, item.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createListingDraft(database, other, input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveListingDraft(database, other, {
        sellerId: businessA,
        draftId: item.id,
        expectedRevision: 1,
        requestId: randomUUID(),
        payload: emptyDraft,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("current authority locks order revocation and subsequent writes/read/replay are denied", async () => {
    const business = await createBusinessSeller(database, owner, {
      name: "Revocation",
      requestId: randomUUID(),
    });
    await admin.query(
      "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'manager','[]')",
      [business, otherUserId],
    );
    const input = {
      sellerId: business,
      requestId: randomUUID(),
      payload: emptyDraft,
    };
    const item = await createListingDraft(database, other, input);
    let revoked = false;
    let removal: Promise<void> | undefined;
    await inTransaction(database, async (tx) => {
      await authorizeSeller(tx, other, business, "listing.write");
      removal = revokeSellerMembership(database, owner, {
        sellerId: business,
        userId: otherUserId,
      }).then(() => {
        revoked = true;
      });
      await waitForBlockedAuthority("seller_accounts", 1);
      expect(revoked).toBe(false);
    });
    await removal;
    expect(revoked).toBe(true);
    await expect(
      createListingDraft(database, other, input),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      readListingDraft(database, other, business, item.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await listListingDrafts(database, owner, business)).toHaveLength(1);
    const ownerId = (
      await admin.query(
        "SELECT created_by FROM treido.seller_accounts WHERE id=$1",
        [business],
      )
    ).rows[0].created_by;
    await expect(
      revokeSellerMembership(database, owner, {
        sellerId: business,
        userId: ownerId,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("only one concurrent create takes the last Free draft slot", async () => {
    const business = await createBusinessSeller(database, owner, {
      name: "Last slot",
      requestId: randomUUID(),
    });
    const ownerId = (
      await admin.query(
        "SELECT created_by FROM treido.seller_accounts WHERE id=$1",
        [business],
      )
    ).rows[0].created_by;
    await admin.query(
      "WITH added AS (INSERT INTO treido.listings(id,seller_id) SELECT gen_random_uuid(),$1::uuid FROM generate_series(1,199) RETURNING id) INSERT INTO treido.listing_drafts(listing_id,seller_id,payload,created_by,creation_key,creation_hash) SELECT id,$1::uuid,$2::jsonb,$3::uuid,gen_random_uuid(),'fixture' FROM added",
      [business, JSON.stringify(emptyDraft), ownerId],
    );
    await admin.query(
      "UPDATE treido.seller_usage SET draft_count=199 WHERE seller_id=$1",
      [business],
    );
    await admin.query("BEGIN");
    await admin.query(
      "SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR UPDATE",
      [business],
    );
    const attemptsPromise = Promise.allSettled(
      [1, 2].map(() =>
        createListingDraft(database, owner, {
          sellerId: business,
          requestId: randomUUID(),
          payload: emptyDraft,
        }),
      ),
    );
    try {
      await waitForBlockedAuthority("seller_usage", 2);
    } finally {
      await admin.query("COMMIT");
    }
    const attempts = await attemptsPromise;
    expect(attempts.filter((row) => row.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(
      attempts
        .filter((row) => row.status === "rejected")
        .map((row) => row.reason.code),
    ).toEqual(["QUOTA_EXCEEDED"]);
    expect(
      (
        await admin.query(
          "SELECT count(*) FROM treido.listing_drafts WHERE seller_id=$1",
          [business],
        )
      ).rows[0].count,
    ).toBe("200");
  });
  it("database ownership constraints and the runtime role enforce their boundaries", async () => {
    const item = await createListingDraft(database, owner, {
      sellerId: businessA,
      requestId: randomUUID(),
      payload: emptyDraft,
    });
    await expect(
      database.pool.query(
        "UPDATE treido.listing_drafts SET seller_id=$1 WHERE listing_id=$2",
        [businessB, item.id],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      database.pool.query("CREATE TABLE treido.unauthorized(id int)"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      database.pool.query("CREATE ROLE unauthorized"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      database.pool.query(
        "ALTER TABLE treido.listings ADD COLUMN unauthorized integer",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const role = await database.pool.query(
      "SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=current_user",
    );
    expect(role.rows).toEqual([
      {
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolreplication: false,
      },
    ]);
  });
  it("failure rolls back domain writes and releases the bounded pool connection", async () => {
    await expect(
      inTransaction(database, async (tx) => {
        await tx.client.query(
          "UPDATE treido.seller_usage SET draft_count=999 WHERE seller_id=$1",
          [personal],
        );
        throw new Error("Synthetic failure");
      }),
    ).rejects.toThrow("Synthetic failure");
    expect(
      (
        await database.pool.query(
          "SELECT draft_count FROM treido.seller_usage WHERE seller_id=$1",
          [personal],
        )
      ).rows[0].draft_count,
    ).not.toBe(999);
    expect(database.pool.waitingCount).toBe(0);
    expect(database.pool.totalCount).toBeLessThanOrEqual(5);
  });
});

defineJobIntegrationCases(() => ({ database, admin, owner, other }));
defineMediaIntegrationCases(() => ({ database, admin, owner, other }));
defineCategoryIntegrationCases(() => ({ database, admin, owner, other }));
defineParticipantIntegrationCases(() => ({ database, admin, owner, other }));
defineInboxIntegrationCases(() => ({ database, admin, owner, other }));
defineModerationIntegrationCases(() => ({ database, admin, owner, other }));
definePublicationIntegrationCases(() => ({ database, admin, owner, other }));
definePublishIntegrationCases(() => ({ database, admin, owner, other }));
defineAdminProductIntegrationCases(() => ({ database, admin, owner, other }));
defineProductManagementIntegrationCases(() => ({
  database,
  admin,
  owner,
  other,
}));

if (process.env.TREIDO_ADMIN_BROWSER_HELPER) {
  // Interactive CUA comparisons across desktop, phone and large-text states.
  // Ordinary database cases retain their separate, short deadlines.
  it("merchant admin components and native database (synthetic identity; no live Clerk)", async () => {
    const helper = await import(process.env.TREIDO_ADMIN_BROWSER_HELPER!);
    const result = await helper.runAdminBrowserChecks({
      database,
      admin,
      owner,
      other,
      api: {
        createBusinessSeller,
        listOwnedSellers,
        createListingDraft,
        saveListingDraft,
        readListingDraft,
        readAdminProducts,
        duplicateSellerProduct,
        duplicateSellerProducts,
        withdrawSellerProducts,
        emptyDraft,
      },
    });
    expect(result.checks).toBeGreaterThanOrEqual(12);
  }, 1800000);
}

if (process.env.TREIDO_SETUP_BROWSER_HELPER) {
  it("actual seller components with native PostgreSQL (synthetic identity; no live Clerk)", async () => {
    const helper = await import(process.env.TREIDO_SETUP_BROWSER_HELPER!);
    const result = await helper.runSetupBrowserChecks({
      database,
      admin,
      owner,
      other,
      otherUserId,
      api: {
        createBusinessSeller,
        listOwnedSellers,
        readSellerContext: async (
          database: SellerDatabase,
          actor: { subject: string },
          sellerId: string,
        ) =>
          inTransaction(
            database,
            async (tx) =>
              (await authorizeSeller(tx, actor, sellerId, "seller.read"))
                .context,
          ),
        readSignupIntent,
        completeSignupIntent,
        readSellerSetup,
        readSellerReadiness,
        saveSellerSetup,
        createListingDraft,
        saveListingDraft,
        readListingDraft,
        revokeSellerMembership,
        emptyDraft,
        recoveryKey: (subject: string, scope: string) =>
          createHash("sha256")
            .update(subject + "/" + scope)
            .digest("hex"),
      },
    });
    expect(result.checks).toBeGreaterThanOrEqual(15);
  }, 180000);
}

if (process.env.TREIDO_INBOX_BROWSER_HELPER) {
  it("real inbox and report components with isolated PostgreSQL and synthetic identities", async () => {
    const helper = await import(process.env.TREIDO_INBOX_BROWSER_HELPER!);
    const result = await helper.runInboxBrowserChecks({
      database,
      admin,
      owner,
      other,
      api: {
        ...inboxApi,
        ...conversationApi,
        ...reportApi,
        ...reviewApi,
        ...reportViews,
        createBusinessSeller,
        createListingDraft,
        emptyDraft,
      },
    });
    expect(result.checks).toBeGreaterThanOrEqual(10);
  }, 180000);
}

defineDiscoveryIntegrationCases(() => ({ database, admin, owner }));

defineLibraryIntegrationCases(() => ({
  database,
  admin,
  owner,
  fresh: () => createDatabase(new Pool(runtimeConfig)),
}));

defineInventoryIntegrationCases(() => ({ database, admin, owner }));

defineImportIntegrationCases(() => ({ database, admin, owner }));

defineTeamIntegrationCases(() => ({ database, admin, owner }));

defineLaunchIntegrationCases(() => ({ database, admin, owner }));

definePurchaseReviewIntegrationCases(() => ({ database, admin, owner }));

definePaymentMaintenanceIntegrationCases(() => ({
  database,
  admin,
  owner,
  other,
}));
