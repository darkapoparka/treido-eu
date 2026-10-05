import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  uuid,
  integer,
  text,
  check,
  jsonb,
  timestamp,
  varchar,
  boolean,
  unique,
  bigint,
  primaryKey,
} from "drizzle-orm/pg-core";

// Literal column/constraint projections of reviewed canonical0034–0038.
// Canonical SQL owns relational foreign keys, triggers and provider effect authority.
const treido = pgSchema("treido");

export const accountLifecycleWorkspaces = treido.table(
  "account_lifecycle_workspaces",
  {
    userId: uuid("user_id").primaryKey(),
    revision: integer("revision").notNull().default(0),
    locale: text("locale"),
    browseScope: text("browse_scope"),
  },
  () => [
    check(
      "account_lifecycle_workspaces_projection_check_1",
      sql.raw("(locale IS NULL)=(browse_scope IS NULL)"),
    ),
    check(
      "account_lifecycle_workspaces_projection_check_2",
      sql.raw("revision>=0"),
    ),
    check(
      "account_lifecycle_workspaces_projection_check_3",
      sql.raw("locale IN('bg','en')"),
    ),
    check(
      "account_lifecycle_workspaces_projection_check_4",
      sql.raw("browse_scope IN('all','personal','business')"),
    ),
  ],
);

export const accountClosurePolicies = treido.table(
  "account_closure_policies",
  {
    id: uuid("id").primaryKey(),
    version: text("version").notNull().unique(),
    payload: jsonb("payload").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  () => [
    check(
      "account_closure_policies_projection_check_1",
      sql.raw(
        "(jsonb_typeof(payload)='object' AND payload->>'version'=version AND payload->'preservesAcceptedEvidence'='true'::jsonb AND payload->'reversibleBeforeEffects'='true'::jsonb AND jsonb_array_length(payload->'rules')=10 AND length(btrim(payload->>'approvalReference'))>0 AND octet_length(payload::text)<=100000) IS TRUE",
      ),
    ),
    check(
      "account_closure_policies_projection_check_2",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
  ],
);

export const accountLifecycleBindings = treido.table(
  "account_lifecycle_bindings",
  {
    id: uuid("id").primaryKey(),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    clerkInstanceId: text("clerk_instance_id").notNull(),
    clerkMode: text("clerk_mode").notNull(),
    mediaScope: varchar("media_scope", { length: 64 }),
    mediaUnversioned: boolean("media_unversioned").notNull().default(false),
    stripeAccount: text("stripe_account"),
    stripeLivemode: boolean("stripe_livemode"),
    stripeApplicationId: text("stripe_application_id"),
    assistantLifecycleVersion: text("assistant_lifecycle_version").notNull(),
    aftercareLifecycleVersion: text("aftercare_lifecycle_version").notNull(),
    securityEnabled: boolean("security_enabled").notNull().default(false),
    closureEnabled: boolean("closure_enabled").notNull().default(false),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  () => [
    check(
      "account_lifecycle_bindings_projection_check_1",
      sql.raw(
        "(stripe_account IS NULL)=(stripe_livemode IS NULL) AND (stripe_account IS NULL)=(stripe_application_id IS NULL)",
      ),
    ),
    check(
      "account_lifecycle_bindings_projection_check_2",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "account_lifecycle_bindings_projection_check_3",
      sql.raw("environment IN('development','test','preview','production')"),
    ),
    check(
      "account_lifecycle_bindings_projection_check_4",
      sql.raw("clerk_mode IN('test','live')"),
    ),
    check(
      "account_lifecycle_bindings_projection_check_5",
      sql.raw("media_scope ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "account_lifecycle_bindings_projection_check_6",
      sql.raw("stripe_account ~ '^acct_[A-Za-z0-9]+$'"),
    ),
  ],
);

export const accountExecutionPlans = treido.table(
  "account_execution_plans",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    closureRequestId: uuid("closure_request_id").notNull(),
    policyId: uuid("policy_id").notNull(),
    bindingId: uuid("binding_id").notNull(),
    planHash: varchar("plan_hash", { length: 64 }).notNull(),
    payload: jsonb("payload").notNull(),
    state: text("state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    acceptanceKey: uuid("acceptance_key"),
    firstEffectAt: timestamp("first_effect_at", {
      withTimezone: true,
      mode: "date",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    unique("account_execution_plans_projection_unique_1").on(
      table.userId,
      table.id,
    ),
    check(
      "account_execution_plans_projection_check_1",
      sql.raw(
        "(jsonb_typeof(payload)='object' AND payload->>'userId'=user_id::text AND payload->>'closureRequestId'=closure_request_id::text AND payload->>'policyId'=policy_id::text AND payload->>'bindingId'=binding_id::text AND jsonb_typeof(payload->'targets')='array' AND jsonb_array_length(payload->'targets')<=125 AND octet_length(payload::text)<=100000) IS TRUE",
      ),
    ),
    check(
      "account_execution_plans_projection_check_2",
      sql.raw(
        "expires_at>created_at AND expires_at<=created_at+interval '16 minutes'",
      ),
    ),
    check(
      "account_execution_plans_projection_check_3",
      sql.raw("(accepted_at IS NULL)=(acceptance_key IS NULL)"),
    ),
    check(
      "account_execution_plans_projection_check_4",
      sql.raw("first_effect_at IS NULL OR accepted_at IS NOT NULL"),
    ),
    check(
      "account_execution_plans_projection_check_5",
      sql.raw("(state='completed')=(completed_at IS NOT NULL)"),
    ),
    check(
      "account_execution_plans_projection_check_6",
      sql.raw("plan_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "account_execution_plans_projection_check_7",
      sql.raw(
        "state IN('reviewed','accepted','processing','blocked','reconciling','cancelled','completed')",
      ),
    ),
  ],
);

export const accountLifecycleStatusEvents = treido.table(
  "account_lifecycle_status_events",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: uuid("user_id").notNull(),
    planId: uuid("plan_id"),
    previousStatus: text("previous_status").notNull(),
    nextStatus: text("next_status").notNull(),
    cause: text("cause").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "account_lifecycle_status_events_projection_check_1",
      sql.raw(
        "cause IN('closure_claim','closure_cancel','closure_finish','external')",
      ),
    ),
  ],
);

export const accountLifecycleEffects = treido.table(
  "account_lifecycle_effects",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    planId: uuid("plan_id"),
    bindingId: uuid("binding_id").notNull(),
    subject: text("subject").notNull(),
    kind: text("kind").notNull(),
    target: jsonb("target").notNull(),
    targetHash: varchar("target_hash", { length: 64 }).notNull(),
    operationKey: uuid("operation_key").notNull().unique(),
    state: text("state").notNull().default("prepared"),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }).notNull(),
    firstAttemptAt: timestamp("first_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true, mode: "date" }),
    confirmedAt: timestamp("confirmed_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    unique("account_lifecycle_effects_projection_unique_1").on(
      table.planId,
      table.kind,
      table.targetHash,
    ),
    check(
      "account_lifecycle_effects_projection_check_1",
      sql.raw("plan_id IS NOT NULL OR kind='session.revoke'"),
    ),
    check(
      "account_lifecycle_effects_projection_check_2",
      sql.raw("(lease_token IS NULL)=(lease_until IS NULL)"),
    ),
    check(
      "account_lifecycle_effects_projection_check_3",
      sql.raw("(state='confirmed')=(confirmed_at IS NOT NULL)"),
    ),
    check(
      "account_lifecycle_effects_projection_check_4",
      sql.raw("subject ~ '^user_[A-Za-z0-9_-]{1,120}$'"),
    ),
    check(
      "account_lifecycle_effects_projection_check_5",
      sql.raw(
        "kind IN('session.revoke','identity.delete','media.delete','billing.stop-renewal','data.remove')",
      ),
    ),
    check(
      "account_lifecycle_effects_projection_check_6",
      sql.raw(
        "jsonb_typeof(target)='object' AND octet_length(target::text)<=4096",
      ),
    ),
    check(
      "account_lifecycle_effects_projection_check_7",
      sql.raw("target_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "account_lifecycle_effects_projection_check_8",
      sql.raw(
        "state IN('prepared','attempting','unknown','confirmed','blocked')",
      ),
    ),
  ],
);

export const accountLifecycleReceipts = treido.table(
  "account_lifecycle_receipts",
  {
    userId: uuid("user_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    acknowledgment: jsonb("acknowledgment").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.requestId] }),
    unique("account_lifecycle_receipts_projection_unique_1").on(
      table.userId,
      table.acceptedRevision,
    ),
    check(
      "account_lifecycle_receipts_projection_check_1",
      sql.raw("input_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "account_lifecycle_receipts_projection_check_2",
      sql.raw(
        "jsonb_typeof(acknowledgment)='object' AND octet_length(acknowledgment::text)<=2048",
      ),
    ),
    check(
      "account_lifecycle_receipts_projection_check_3",
      sql.raw("accepted_revision>0"),
    ),
  ],
);

export const accountEffectObservations = treido.table(
  "account_effect_observations",
  {
    effectId: uuid("effect_id").notNull(),
    evidenceHash: varchar("evidence_hash", { length: 64 }).notNull(),
    state: text("state").notNull(),
    source: text("source").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    primaryKey({ columns: [table.effectId, table.evidenceHash] }),
    check(
      "account_effect_observations_projection_check_1",
      sql.raw("evidence_hash ~ '^[0-9a-f]{64}$'"),
    ),
    check(
      "account_effect_observations_projection_check_2",
      sql.raw("state IN('confirmed','unknown','blocked')"),
    ),
    check(
      "account_effect_observations_projection_check_3",
      sql.raw("source IN('provider','database')"),
    ),
  ],
);
