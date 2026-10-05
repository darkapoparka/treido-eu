import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  check,
  uuid,
  text,
  boolean,
  timestamp,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
// Literal current shipping column/check projections. Canonical SQL owns FKs, private grants and effect authority.
const treido = pgSchema("treido");
export const orderShippingRetentionApprovals = treido.table(
  "order_shipping_retention_approvals",
  {
    id: uuid("id").primaryKey(),
    policyId: uuid("policy_id").notNull(),
    policyHash: text("policy_hash").notNull(),
    version: text("version").notNull(),
    platformAccount: text("platform_account").notNull(),
    livemode: boolean("livemode").notNull(),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    executorApplicationId: text("executor_application_id").notNull(),
    executorEnvironment: text("executor_environment").notNull(),
    clerkInstanceId: text("clerk_instance_id").notNull(),
    clerkMode: text("clerk_mode").notNull(),
    aftercareLifecycleVersion: text("aftercare_lifecycle_version").notNull(),
    deletesDueUnbound: boolean("deletes_due_unbound").notNull(),
    deletesDueAccepted: boolean("deletes_due_accepted").notNull(),
    preservesAcceptedHistory: boolean("preserves_accepted_history").notNull(),
    requiresZeroObligations: boolean("requires_zero_obligations").notNull(),
    legalHoldsReviewed: boolean("legal_holds_reviewed").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvalReference: text("approval_reference").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("order_shipping_retention_approvals_projection_unique_0").on(
      table.policyId,
      table.version,
      table.executorApplicationId,
      table.executorEnvironment,
    ),
    check(
      "order_shipping_retention_approvals_projection_check_0",
      sql.raw("policy_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_1",
      sql.raw("version='order-shipping-retention-v1'"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_2",
      sql.raw("platform_account~'^acct_[A-Za-z0-9]+$'"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_3",
      sql.raw("environment IN('development','test','preview','production')"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_4",
      sql.raw("application_id~'^[a-z][a-z0-9-]{1,79}$'"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_5",
      sql.raw("executor_application_id~'^[a-z][a-z0-9-]{1,79}$'"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_6",
      sql.raw("executor_environment~'^[a-z][a-z0-9-]{1,63}$'"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_7",
      sql.raw("length(clerk_instance_id) BETWEEN 1 AND 200"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_8",
      sql.raw("clerk_mode IN('test','live')"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_9",
      sql.raw("aftercare_lifecycle_version='order-aftercare-shipping-v2'"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_10",
      sql.raw("deletes_due_unbound"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_11",
      sql.raw("deletes_due_accepted"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_12",
      sql.raw("preserves_accepted_history"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_13",
      sql.raw("requires_zero_obligations"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_14",
      sql.raw("legal_holds_reviewed"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_15",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
    check(
      "order_shipping_retention_approvals_projection_check_16",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
  ],
);
export const orderShippingIntegrationQualifications = treido.table(
  "order_shipping_integration_qualifications",
  {
    id: uuid("id").primaryKey(),
    policyId: uuid("policy_id").notNull(),
    policyHash: text("policy_hash").notNull(),
    version: text("version").notNull(),
    canonicalLedgerHash: text("canonical_ledger_hash").notNull(),
    sourceManifestHash: text("source_manifest_hash").notNull(),
    nativeReceiptHash: text("native_receipt_hash").notNull(),
    compilerReceiptHash: text("compiler_receipt_hash").notNull(),
    registeredKinds: jsonb("registered_kinds").notNull(),
    quoteComponentsReviewed: boolean("quote_components_reviewed").notNull(),
    refundComponentsReviewed: boolean("refund_components_reviewed").notNull(),
    signedExpiryReviewed: boolean("signed_expiry_reviewed").notNull(),
    closureAggregationReviewed: boolean(
      "closure_aggregation_reviewed",
    ).notNull(),
    auditResult: text("audit_result").notNull(),
    auditReviewReference: text("audit_review_reference").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvalReference: text("approval_reference").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  () => [
    check(
      "order_shipping_integration_qualifications_projection_check_0",
      sql.raw("policy_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_1",
      sql.raw("version='original-shipping-integration-v1'"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_2",
      sql.raw("canonical_ledger_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_3",
      sql.raw("source_manifest_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_4",
      sql.raw("native_receipt_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_5",
      sql.raw("compiler_receipt_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_6",
      sql.raw(
        'registered_kinds=\'["shipping.input-expiry","shipping.recipient-expiry"]\'::jsonb',
      ),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_7",
      sql.raw("quote_components_reviewed"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_8",
      sql.raw("refund_components_reviewed"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_9",
      sql.raw("signed_expiry_reviewed"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_10",
      sql.raw("closure_aggregation_reviewed"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_11",
      sql.raw("audit_result IN('passed','owner_accepted')"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_12",
      sql.raw("length(audit_review_reference) BETWEEN 1 AND 200"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_13",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
    check(
      "order_shipping_integration_qualifications_projection_check_14",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
  ],
);
