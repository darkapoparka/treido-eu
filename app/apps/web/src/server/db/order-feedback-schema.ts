import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  uuid,
  integer,
  text,
  jsonb,
  varchar,
  boolean,
  timestamp,
  unique,
  check,
  smallint,
  primaryKey,
} from "drizzle-orm/pg-core";

// Literal column/constraint projections of reviewed canonical0034–0038.
// Canonical SQL owns relational foreign keys, triggers and provider effect authority.
const treido = pgSchema("treido");

export const orderFeedbackPolicies = treido.table(
  "order_feedback_policies",
  {
    id: uuid("id").primaryKey(),
    basePolicyId: uuid("base_policy_id").notNull(),
    version: integer("version").notNull(),
    eligibility: text("eligibility").notNull(),
    moderation: text("moderation").notNull(),
    terms: jsonb("terms").notNull(),
    termsHash: varchar("terms_hash", { length: 64 }).notNull(),
    retentionDescription: jsonb("retention_description").notNull(),
    platformAccount: text("platform_account").notNull(),
    livemode: boolean("livemode").notNull(),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvalReference: text("approval_reference").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("order_feedback_policies_projection_unique_1").on(
      table.basePolicyId,
      table.version,
    ),
    check(
      "order_feedback_policies_projection_check_1",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "order_feedback_policies_projection_check_2",
      sql.raw(
        "coalesce(jsonb_typeof(terms)='object' AND jsonb_typeof(terms->'bg')='string' AND jsonb_typeof(terms->'en')='string' AND length(terms->>'bg') BETWEEN 1 AND 5000 AND length(terms->>'en') BETWEEN 1 AND 5000,false)",
      ),
    ),
    check("order_feedback_policies_projection_check_3", sql.raw("version>0")),
    check(
      "order_feedback_policies_projection_check_4",
      sql.raw("eligibility='completed_paid_no_refund'"),
    ),
    check(
      "order_feedback_policies_projection_check_5",
      sql.raw("moderation='explicit_approved_operator'"),
    ),
    check(
      "order_feedback_policies_projection_check_6",
      sql.raw("terms_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_feedback_policies_projection_check_7",
      sql.raw(
        "coalesce(jsonb_typeof(retention_description->'bg')='string' AND jsonb_typeof(retention_description->'en')='string',false)",
      ),
    ),
    check(
      "order_feedback_policies_projection_check_8",
      sql.raw("platform_account~'^acct_[A-Za-z0-9]+$'"),
    ),
    check(
      "order_feedback_policies_projection_check_9",
      sql.raw("environment IN ('development','test','preview','production')"),
    ),
    check(
      "order_feedback_policies_projection_check_10",
      sql.raw("application_id~'^[a-z][a-z0-9-]{1,79}$'"),
    ),
    check(
      "order_feedback_policies_projection_check_11",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
  ],
);

export const orderPurchaseFeedback = treido.table(
  "order_purchase_feedback",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id").notNull().unique(),
    buyerId: uuid("buyer_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    policyId: uuid("policy_id").notNull(),
    rating: smallint("rating").notNull(),
    body: text("body").notNull(),
    language: text("language").notNull(),
    state: text("state").notNull().default("pending"),
    revision: integer("revision").notNull().default(0),
    reason: text("reason"),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "order_purchase_feedback_projection_check_1",
      sql.raw("state<>'published' OR published_at IS NOT NULL"),
    ),
    check(
      "order_purchase_feedback_projection_check_2",
      sql.raw("rating BETWEEN 1 AND 5"),
    ),
    check(
      "order_purchase_feedback_projection_check_3",
      sql.raw("length(body) BETWEEN 1 AND 2000"),
    ),
    check(
      "order_purchase_feedback_projection_check_4",
      sql.raw("language IN ('bg','en')"),
    ),
    check(
      "order_purchase_feedback_projection_check_5",
      sql.raw("state IN ('pending','published','hidden')"),
    ),
    check("order_purchase_feedback_projection_check_6", sql.raw("revision>=0")),
    check(
      "order_purchase_feedback_projection_check_7",
      sql.raw("length(reason) BETWEEN 1 AND 1000"),
    ),
  ],
);

export const orderFeedbackEvents = treido.table(
  "order_feedback_events",
  {
    id: uuid("id").primaryKey(),
    feedbackId: uuid("feedback_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    unique("order_feedback_events_projection_unique_1").on(
      table.feedbackId,
      table.acceptedRevision,
    ),
    check(
      "order_feedback_events_projection_check_1",
      sql.raw("action IN ('submit','publish','hide')"),
    ),
    check(
      "order_feedback_events_projection_check_2",
      sql.raw("length(reason)<=1000"),
    ),
    check(
      "order_feedback_events_projection_check_3",
      sql.raw("accepted_revision>=0"),
    ),
  ],
);

export const orderFeedbackReceipts = treido.table(
  "order_feedback_receipts",
  {
    actorId: uuid("actor_id").notNull(),
    requestId: uuid("request_id").notNull(),
    orderId: uuid("order_id").notNull(),
    feedbackId: uuid("feedback_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    action: text("action").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    primaryKey({ columns: [table.actorId, table.requestId] }),
    check(
      "order_feedback_receipts_projection_check_1",
      sql.raw("input_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_feedback_receipts_projection_check_2",
      sql.raw("action IN ('submit','publish','hide')"),
    ),
    check(
      "order_feedback_receipts_projection_check_3",
      sql.raw("accepted_revision>=0"),
    ),
  ],
);
