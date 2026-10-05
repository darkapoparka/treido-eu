import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  uuid,
  text,
  jsonb,
  timestamp,
  check,
  integer,
  boolean,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

// Literal column/constraint projections of reviewed canonical0034–0038.
// Canonical SQL owns relational foreign keys, triggers and provider effect authority.
const treido = pgSchema("treido");

export const assistantRuntimePolicies = treido.table(
  "assistant_runtime_policies",
  {
    id: uuid("id").primaryKey(),
    applicationId: text("application_id").notNull(),
    environment: text("environment").notNull(),
    purpose: text("purpose").notNull(),
    config: jsonb("config").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  () => [
    check(
      "assistant_runtime_policies_projection_check_1",
      sql.raw("application_id ~ '^app_[A-Za-z0-9]{3,128}$'"),
    ),
    check(
      "assistant_runtime_policies_projection_check_2",
      sql.raw("environment IN ('development','test','preview','production')"),
    ),
    check(
      "assistant_runtime_policies_projection_check_3",
      sql.raw("purpose='shopping-input-v1'"),
    ),
    check(
      "assistant_runtime_policies_projection_check_4",
      sql.raw(
        "(jsonb_typeof(config)='object' AND config->>'version'='1'\n    AND config->>'budgetCurrency'='USD' AND octet_length(config::text)<=16000) IS TRUE",
      ),
    ),
    check(
      "assistant_runtime_policies_projection_check_5",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
  ],
);

export const buyerAssistantConsents = treido.table(
  "buyer_assistant_consents",
  {
    userId: uuid("user_id").notNull(),
    mode: text("mode").notNull(),
    policyId: uuid("policy_id").notNull(),
    revision: integer("revision").notNull().default(0),
    granted: boolean("granted").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mode] }),
    check(
      "buyer_assistant_consents_projection_check_1",
      sql.raw("mode IN ('text','photo','voice')"),
    ),
    check(
      "buyer_assistant_consents_projection_check_2",
      sql.raw("revision BETWEEN 0 AND 2147483646"),
    ),
  ],
);

export const assistantMediaAssets = treido.table(
  "assistant_media_assets",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    mode: text("mode").notNull(),
    policyId: uuid("policy_id").notNull(),
    inputHash: text("input_hash").notNull(),
    expectedBytes: integer("expected_bytes").notNull(),
    contentType: text("content_type").notNull(),
    expectedChecksum: text("expected_checksum").notNull(),
    storageScope: text("storage_scope").notNull(),
    stagingKey: text("staging_key").notNull(),
    immutableKey: text("immutable_key"),
    readyKey: text("ready_key"),
    readyChecksum: text("ready_checksum"),
    readyBytes: integer("ready_bytes"),
    state: text("state").notNull().default("staged"),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    writeUntil: timestamp("write_until", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    unique("assistant_media_assets_projection_unique_1").on(
      table.id,
      table.userId,
      table.mode,
    ),
    unique("assistant_media_assets_projection_unique_2").on(
      table.id,
      table.userId,
    ),
    check(
      "assistant_media_assets_projection_check_1",
      sql.raw(
        "expires_at>created_at AND write_until>=expires_at AND write_until<=expires_at+interval '10 minutes'",
      ),
    ),
    check(
      "assistant_media_assets_projection_check_2",
      sql.raw(
        "(state<>'ready' OR (ready_key IS NOT NULL AND ready_checksum IS NOT NULL AND ready_bytes IS NOT NULL)) IS TRUE",
      ),
    ),
    check(
      "assistant_media_assets_projection_check_3",
      sql.raw(
        "(mode='voice' AND content_type='audio/wav') OR (mode='photo' AND content_type<>'audio/wav')",
      ),
    ),
    check(
      "assistant_media_assets_projection_check_4",
      sql.raw("mode IN ('photo','voice')"),
    ),
    check(
      "assistant_media_assets_projection_check_5",
      sql.raw("input_hash ~ '^[a-f0-9]{64}$'"),
    ),
    check(
      "assistant_media_assets_projection_check_6",
      sql.raw("expected_bytes BETWEEN 1 AND 12582912"),
    ),
    check(
      "assistant_media_assets_projection_check_7",
      sql.raw(
        "content_type IN ('image/jpeg','image/png','image/webp','audio/wav')",
      ),
    ),
    check(
      "assistant_media_assets_projection_check_8",
      sql.raw("expected_checksum ~ '^[a-f0-9]{64}$'"),
    ),
    check(
      "assistant_media_assets_projection_check_9",
      sql.raw("storage_scope ~ '^[a-f0-9]{64}$'"),
    ),
    check(
      "assistant_media_assets_projection_check_10",
      sql.raw("length(staging_key) BETWEEN 20 AND 300"),
    ),
    check(
      "assistant_media_assets_projection_check_11",
      sql.raw("ready_checksum IS NULL OR ready_checksum ~ '^[a-f0-9]{64}$'"),
    ),
    check(
      "assistant_media_assets_projection_check_12",
      sql.raw("ready_bytes BETWEEN 1 AND 12582912"),
    ),
    check(
      "assistant_media_assets_projection_check_13",
      sql.raw(
        "state IN ('staged','validating','ready','unknown','cancelled','expired')",
      ),
    ),
  ],
);

export const assistantMediaObjects = treido.table(
  "assistant_media_objects",
  {
    storageScope: text("storage_scope").notNull(),
    objectKey: text("object_key").notNull(),
    userId: uuid("user_id").notNull(),
    assetId: uuid("asset_id").notNull(),
    kind: text("kind").notNull(),
    writeUntil: timestamp("write_until", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    retainUntil: timestamp("retain_until", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    state: text("state").notNull().default("tracked"),
    deletionToken: uuid("deletion_token"),
    deletionUntil: timestamp("deletion_until", {
      withTimezone: true,
      mode: "date",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    primaryKey({ columns: [table.storageScope, table.objectKey] }),
    check(
      "assistant_media_objects_projection_check_1",
      sql.raw("retain_until>=write_until"),
    ),
    check(
      "assistant_media_objects_projection_check_2",
      sql.raw("(deletion_token IS NULL)=(deletion_until IS NULL)"),
    ),
    check(
      "assistant_media_objects_projection_check_3",
      sql.raw("(state='deleted')=(deleted_at IS NOT NULL)"),
    ),
    check(
      "assistant_media_objects_projection_check_4",
      sql.raw("storage_scope ~ '^[a-f0-9]{64}$'"),
    ),
    check(
      "assistant_media_objects_projection_check_5",
      sql.raw("length(object_key) BETWEEN 20 AND 300"),
    ),
    check(
      "assistant_media_objects_projection_check_6",
      sql.raw("kind IN ('staging','immutable','ready')"),
    ),
    check(
      "assistant_media_objects_projection_check_7",
      sql.raw("state IN ('tracked','deleting','deleted')"),
    ),
  ],
);

export const assistantRuns = treido.table(
  "assistant_runs",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    mode: text("mode").notNull(),
    policyId: uuid("policy_id").notNull(),
    mediaId: uuid("media_id"),
    inputHash: text("input_hash").notNull(),
    inputJson: jsonb("input_json"),
    proposal: jsonb("proposal"),
    acceptedCriteria: text("accepted_criteria"),
    state: text("state").notNull().default("reserved"),
    providerId: text("provider_id"),
    steps: integer("steps").notNull().default(0),
    emissionStartedAt: timestamp("emission_started_at", {
      withTimezone: true,
      mode: "date",
    }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    unique("assistant_runs_projection_unique_1").on(
      table.id,
      table.userId,
      table.mode,
    ),
    unique("assistant_runs_projection_unique_2").on(table.id, table.userId),
    check(
      "assistant_runs_projection_check_1",
      sql.raw(
        "(mode='text' AND media_id IS NULL) OR (mode<>'text' AND media_id IS NOT NULL)",
      ),
    ),
    check(
      "assistant_runs_projection_check_2",
      sql.raw("expires_at>created_at"),
    ),
    check(
      "assistant_runs_projection_check_3",
      sql.raw("(steps=0)=(emission_started_at IS NULL)"),
    ),
    check(
      "assistant_runs_projection_check_4",
      sql.raw("provider_id IS NULL OR emission_started_at IS NOT NULL"),
    ),
    check(
      "assistant_runs_projection_check_5",
      sql.raw("mode IN ('text','photo','voice')"),
    ),
    check(
      "assistant_runs_projection_check_6",
      sql.raw("input_hash ~ '^[a-f0-9]{64}$'"),
    ),
    check(
      "assistant_runs_projection_check_7",
      sql.raw(
        "input_json IS NULL OR (jsonb_typeof(input_json)='object' AND octet_length(input_json::text)<=16000) IS TRUE",
      ),
    ),
    check(
      "assistant_runs_projection_check_8",
      sql.raw(
        "proposal IS NULL OR (jsonb_typeof(proposal)='object' AND octet_length(proposal::text)<=16000) IS TRUE",
      ),
    ),
    check(
      "assistant_runs_projection_check_9",
      sql.raw(
        "accepted_criteria IS NULL OR octet_length(accepted_criteria)<=6000",
      ),
    ),
    check(
      "assistant_runs_projection_check_10",
      sql.raw(
        "state IN ('reserved','calling','unknown','proposed','accepted','cancelled','failed')",
      ),
    ),
    check(
      "assistant_runs_projection_check_11",
      sql.raw(
        "provider_id IS NULL OR provider_id ~ '^gen_[0-9A-HJKMNP-TV-Z]{26}$'",
      ),
    ),
    check(
      "assistant_runs_projection_check_12",
      sql.raw("steps BETWEEN 0 AND 6"),
    ),
  ],
);

export const buyerAssistantWorkspaces = treido.table(
  "buyer_assistant_workspaces",
  {
    userId: uuid("user_id").notNull(),
    mode: text("mode").notNull(),
    revision: integer("revision").notNull().default(0),
    currentRunId: uuid("current_run_id"),
    currentAssetId: uuid("current_asset_id"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mode] }),
    check(
      "buyer_assistant_workspaces_projection_check_1",
      sql.raw("mode IN ('text','photo','voice')"),
    ),
    check(
      "buyer_assistant_workspaces_projection_check_2",
      sql.raw("revision BETWEEN 0 AND 2147483646"),
    ),
  ],
);

export const assistantRunReservations = treido.table(
  "assistant_run_reservations",
  {
    runId: uuid("run_id").primaryKey(),
    userId: uuid("user_id").notNull(),
    applicationId: text("application_id").notNull(),
    environment: text("environment").notNull(),
    reservedMinor: integer("reserved_minor").notNull(),
    actualMinor: integer("actual_minor"),
    currency: text("currency").notNull(),
    status: text("status").notNull().default("reserved"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "assistant_run_reservations_projection_check_1",
      sql.raw("(status='settled')=(actual_minor IS NOT NULL)"),
    ),
    check(
      "assistant_run_reservations_projection_check_2",
      sql.raw("environment IN ('development','test','preview','production')"),
    ),
    check(
      "assistant_run_reservations_projection_check_3",
      sql.raw("reserved_minor BETWEEN 1 AND 1000000"),
    ),
    check(
      "assistant_run_reservations_projection_check_4",
      sql.raw("actual_minor BETWEEN 0 AND 1000000"),
    ),
    check(
      "assistant_run_reservations_projection_check_5",
      sql.raw("currency='USD'"),
    ),
    check(
      "assistant_run_reservations_projection_check_6",
      sql.raw(
        "status IN ('reserved','calling','unknown','settled','released')",
      ),
    ),
  ],
);

export const buyerAssistantReceipts = treido.table(
  "buyer_assistant_receipts",
  {
    userId: uuid("user_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: text("input_hash").notNull(),
    operation: text("operation").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    runId: uuid("run_id"),
    assetId: uuid("asset_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.requestId] }),
    check(
      "buyer_assistant_receipts_projection_check_1",
      sql.raw("input_hash ~ '^[a-f0-9]{64}$'"),
    ),
    check(
      "buyer_assistant_receipts_projection_check_2",
      sql.raw(
        "operation IN ('consent','stage','complete','prepare','execute','accept','cancel')",
      ),
    ),
    check(
      "buyer_assistant_receipts_projection_check_3",
      sql.raw("accepted_revision BETWEEN 1 AND 2147483646"),
    ),
  ],
);

export const assistantUsageEvidence = treido.table(
  "assistant_usage_evidence",
  {
    runId: uuid("run_id").primaryKey(),
    providerId: text("provider_id").notNull().unique(),
    actualMinor: integer("actual_minor").notNull(),
    currency: text("currency").notNull(),
    proofHash: text("proof_hash").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "assistant_usage_evidence_projection_check_1",
      sql.raw("provider_id ~ '^gen_[0-9A-HJKMNP-TV-Z]{26}$'"),
    ),
    check(
      "assistant_usage_evidence_projection_check_2",
      sql.raw("actual_minor BETWEEN 0 AND 1000000"),
    ),
    check(
      "assistant_usage_evidence_projection_check_3",
      sql.raw("currency='USD'"),
    ),
    check(
      "assistant_usage_evidence_projection_check_4",
      sql.raw("proof_hash ~ '^[a-f0-9]{64}$'"),
    ),
  ],
);
