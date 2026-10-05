import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  uuid,
  integer,
  jsonb,
  varchar,
  text,
  boolean,
  timestamp,
  unique,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";

// Literal column/constraint projections of reviewed canonical0034–0038.
// Canonical SQL owns relational foreign keys, triggers and provider effect authority.
const treido = pgSchema("treido");

export const orderServicePolicies = treido.table(
  "order_service_policies",
  {
    id: uuid("id").primaryKey(),
    basePolicyId: uuid("base_policy_id").notNull(),
    version: integer("version").notNull(),
    terms: jsonb("terms").notNull(),
    termsHash: varchar("terms_hash", { length: 64 }).notNull(),
    retentionDescription: jsonb("retention_description").notNull(),
    caseLimit: integer("case_limit").notNull(),
    eventLimit: integer("event_limit").notNull(),
    appealSeconds: integer("appeal_seconds"),
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
    unique("order_service_policies_projection_unique_1").on(
      table.basePolicyId,
      table.version,
    ),
    check(
      "order_service_policies_projection_check_1",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "order_service_policies_projection_check_2",
      sql.raw(
        "coalesce(jsonb_typeof(terms)='object' AND jsonb_typeof(terms->'bg')='string' AND jsonb_typeof(terms->'en')='string' AND length(terms->>'bg') BETWEEN 1 AND 5000 AND length(terms->>'en') BETWEEN 1 AND 5000,false)",
      ),
    ),
    check("order_service_policies_projection_check_3", sql.raw("version>0")),
    check(
      "order_service_policies_projection_check_4",
      sql.raw("terms_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_service_policies_projection_check_5",
      sql.raw(
        "coalesce(jsonb_typeof(retention_description->'bg')='string' AND jsonb_typeof(retention_description->'en')='string' AND length(retention_description->>'bg') BETWEEN 1 AND 2000 AND length(retention_description->>'en') BETWEEN 1 AND 2000,false)",
      ),
    ),
    check(
      "order_service_policies_projection_check_6",
      sql.raw("case_limit BETWEEN 1 AND 5"),
    ),
    check(
      "order_service_policies_projection_check_7",
      sql.raw("event_limit BETWEEN 1 AND 500"),
    ),
    check(
      "order_service_policies_projection_check_8",
      sql.raw("appeal_seconds BETWEEN 1 AND 31536000"),
    ),
    check(
      "order_service_policies_projection_check_9",
      sql.raw("platform_account~'^acct_[A-Za-z0-9]+$'"),
    ),
    check(
      "order_service_policies_projection_check_10",
      sql.raw("environment IN ('development','test','preview','production')"),
    ),
    check(
      "order_service_policies_projection_check_11",
      sql.raw("application_id~'^[a-z][a-z0-9-]{1,79}$'"),
    ),
    check(
      "order_service_policies_projection_check_12",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
  ],
);

export const orderFinancialPolicies = treido.table(
  "order_financial_policies",
  {
    id: uuid("id").primaryKey(),
    basePolicyId: uuid("base_policy_id").notNull(),
    version: integer("version").notNull(),
    purpose: text("purpose").notNull(),
    method: text("method").notNull(),
    refundContract: text("refund_contract").notNull(),
    terms: jsonb("terms").notNull(),
    termsHash: varchar("terms_hash", { length: 64 }).notNull(),
    executionSeconds: integer("execution_seconds").notNull(),
    refundRequestLimit: integer("refund_request_limit").notNull(),
    taxBasis: text("tax_basis").notNull(),
    feeBasis: text("fee_basis").notNull(),
    reverseTransfer: boolean("reverse_transfer").notNull(),
    refundApplicationFee: boolean("refund_application_fee").notNull(),
    trackingAllowed: boolean("tracking_allowed").notNull(),
    recipientRetentionDescription: jsonb(
      "recipient_retention_description",
    ).notNull(),
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
    unique("order_financial_policies_projection_unique_1").on(
      table.basePolicyId,
      table.version,
    ),
    check(
      "order_financial_policies_projection_check_1",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "order_financial_policies_projection_check_2",
      sql.raw(
        "coalesce(jsonb_typeof(terms)='object' AND jsonb_typeof(terms->'bg')='string' AND jsonb_typeof(terms->'en')='string' AND length(terms->>'bg') BETWEEN 1 AND 5000 AND length(terms->>'en') BETWEEN 1 AND 5000,false)",
      ),
    ),
    check(
      "order_financial_policies_projection_check_3",
      sql.raw("NOT tracking_allowed OR method='shipping'"),
    ),
    check("order_financial_policies_projection_check_4", sql.raw("version>0")),
    check(
      "order_financial_policies_projection_check_5",
      sql.raw("purpose='goods_aftercare_v2'"),
    ),
    check(
      "order_financial_policies_projection_check_6",
      sql.raw("method IN ('pickup','shipping')"),
    ),
    check(
      "order_financial_policies_projection_check_7",
      sql.raw("refund_contract='bounded_partial_v2'"),
    ),
    check(
      "order_financial_policies_projection_check_8",
      sql.raw("terms_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_financial_policies_projection_check_9",
      sql.raw("execution_seconds BETWEEN 60 AND 86400"),
    ),
    check(
      "order_financial_policies_projection_check_10",
      sql.raw("refund_request_limit BETWEEN 1 AND 30"),
    ),
    check(
      "order_financial_policies_projection_check_11",
      sql.raw("tax_basis='inclusive_unspecified'"),
    ),
    check(
      "order_financial_policies_projection_check_12",
      sql.raw("fee_basis='original_proportional_provider_reversal'"),
    ),
    check(
      "order_financial_policies_projection_check_13",
      sql.raw("reverse_transfer"),
    ),
    check(
      "order_financial_policies_projection_check_14",
      sql.raw("refund_application_fee"),
    ),
    check(
      "order_financial_policies_projection_check_15",
      sql.raw(
        "coalesce(jsonb_typeof(recipient_retention_description->'bg')='string' AND jsonb_typeof(recipient_retention_description->'en')='string',false)",
      ),
    ),
    check(
      "order_financial_policies_projection_check_16",
      sql.raw("platform_account~'^acct_[A-Za-z0-9]+$'"),
    ),
    check(
      "order_financial_policies_projection_check_17",
      sql.raw("environment IN ('development','test','preview','production')"),
    ),
    check(
      "order_financial_policies_projection_check_18",
      sql.raw("application_id~'^[a-z][a-z0-9-]{1,79}$'"),
    ),
    check(
      "order_financial_policies_projection_check_19",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
  ],
);

export const quoteAftercareAcceptances = treido.table(
  "quote_aftercare_acceptances",
  {
    quoteId: uuid("quote_id").primaryKey(),
    policyId: uuid("policy_id").notNull(),
    buyerId: uuid("buyer_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    version: integer("version").notNull(),
    termsHash: varchar("terms_hash", { length: 64 }).notNull(),
    choiceHash: varchar("choice_hash", { length: 64 }).notNull(),
    method: text("method").notNull(),
    language: text("language").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "quote_aftercare_acceptances_projection_check_1",
      sql.raw("version>0"),
    ),
    check(
      "quote_aftercare_acceptances_projection_check_2",
      sql.raw("terms_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "quote_aftercare_acceptances_projection_check_3",
      sql.raw("choice_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "quote_aftercare_acceptances_projection_check_4",
      sql.raw("method IN ('pickup','shipping')"),
    ),
    check(
      "quote_aftercare_acceptances_projection_check_5",
      sql.raw("language IN ('bg','en')"),
    ),
  ],
);

export const orderCases = treido.table(
  "order_cases",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id").notNull(),
    buyerId: uuid("buyer_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    policyId: uuid("policy_id").notNull(),
    reason: text("reason").notNull(),
    state: text("state").notNull(),
    revision: integer("revision").notNull().default(0),
    appealUntil: timestamp("appeal_until", {
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
  (table) => [
    unique("order_cases_projection_unique_1").on(table.id, table.orderId),
    check(
      "order_cases_projection_check_1",
      sql.raw(
        "reason IN ('handover','item_condition','refund_question','other')",
      ),
    ),
    check(
      "order_cases_projection_check_2",
      sql.raw(
        "state IN ('open','awaiting_buyer','review_requested','reviewed','resolved')",
      ),
    ),
    check("order_cases_projection_check_3", sql.raw("revision>=0")),
  ],
);

export const orderCaseEvents = treido.table(
  "order_case_events",
  {
    id: uuid("id").primaryKey(),
    caseId: uuid("case_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    side: text("side").notNull(),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    evidence: jsonb("evidence").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    unique("order_case_events_projection_unique_1").on(
      table.caseId,
      table.acceptedRevision,
    ),
    check(
      "order_case_events_projection_check_1",
      sql.raw("side IN ('buyer','merchant','operator')"),
    ),
    check(
      "order_case_events_projection_check_2",
      sql.raw(
        "kind IN ('open','message','propose','accept','reopen','escalate','appeal','operator_recommendation','operator_information','operator_no_decision')",
      ),
    ),
    check(
      "order_case_events_projection_check_3",
      sql.raw("length(body)<=2000"),
    ),
    check(
      "order_case_events_projection_check_4",
      sql.raw(
        "coalesce(jsonb_typeof(evidence)='array' AND jsonb_array_length(evidence)<=4,false)",
      ),
    ),
    check(
      "order_case_events_projection_check_5",
      sql.raw("accepted_revision>=0"),
    ),
  ],
);

export const orderAftercareReceipts = treido.table(
  "order_aftercare_receipts",
  {
    orderId: uuid("order_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    action: text("action").notNull(),
    caseId: uuid("case_id"),
    intentId: uuid("intent_id"),
    acceptedRevision: integer("accepted_revision").notNull(),
    acceptedState: text("accepted_state").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    primaryKey({ columns: [table.orderId, table.actorId, table.requestId] }),
    check(
      "order_aftercare_receipts_projection_check_1",
      sql.raw("input_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_aftercare_receipts_projection_check_2",
      sql.raw("accepted_revision>=0"),
    ),
  ],
);

export const orderFulfilments = treido.table(
  "order_fulfilments",
  {
    orderId: uuid("order_id").primaryKey(),
    quoteId: uuid("quote_id").notNull(),
    method: text("method").notNull(),
    state: text("state").notNull(),
    revision: integer("revision").notNull().default(0),
    carrier: text("carrier"),
    trackingReference: text("tracking_reference"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "order_fulfilments_projection_check_1",
      sql.raw(
        "method='shipping' OR (carrier IS NULL AND tracking_reference IS NULL)",
      ),
    ),
    check(
      "order_fulfilments_projection_check_2",
      sql.raw(
        "state<>'seller_reported_dispatched' OR (method='shipping' AND carrier IS NOT NULL AND tracking_reference IS NOT NULL)",
      ),
    ),
    check(
      "order_fulfilments_projection_check_3",
      sql.raw("method IN ('pickup','shipping')"),
    ),
    check(
      "order_fulfilments_projection_check_4",
      sql.raw(
        "state IN ('pending','seller_reported_dispatched','buyer_confirmed_delivery','blocked')",
      ),
    ),
    check("order_fulfilments_projection_check_5", sql.raw("revision>=0")),
    check(
      "order_fulfilments_projection_check_6",
      sql.raw("length(carrier) BETWEEN 1 AND 80"),
    ),
    check(
      "order_fulfilments_projection_check_7",
      sql.raw("length(tracking_reference) BETWEEN 1 AND 100"),
    ),
    check(
      "order_fulfilments_projection_check_8",
      sql.raw("length(description)<=500"),
    ),
  ],
);

export const orderFulfilmentEvents = treido.table(
  "order_fulfilment_events",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    kind: text("kind").notNull(),
    description: text("description").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    unique("order_fulfilment_events_projection_unique_1").on(
      table.orderId,
      table.acceptedRevision,
    ),
    check(
      "order_fulfilment_events_projection_check_1",
      sql.raw(
        "kind IN ('seller_reported_dispatched','buyer_confirmed_delivery')",
      ),
    ),
    check(
      "order_fulfilment_events_projection_check_2",
      sql.raw("length(description) BETWEEN 1 AND 500"),
    ),
    check(
      "order_fulfilment_events_projection_check_3",
      sql.raw("accepted_revision>0"),
    ),
  ],
);

export const orderRefundIntents = treido.table(
  "order_refund_intents",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    policyId: uuid("policy_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    buyerId: uuid("buyer_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    caseId: uuid("case_id"),
    requestId: uuid("request_id").notNull(),
    inputHash: varchar("input_hash", { length: 64 }).notNull(),
    reason: text("reason").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    feeMinor: integer("fee_minor").notNull(),
    currency: text("currency").notNull(),
    taxBasis: text("tax_basis").notNull(),
    platformAccount: text("platform_account").notNull(),
    livemode: boolean("livemode").notNull(),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    paymentIntentId: text("payment_intent_id").notNull(),
    chargeId: text("charge_id").notNull(),
    connectedAccount: text("connected_account").notNull(),
    apiVersion: text("api_version").notNull(),
    operationKey: text("operation_key").notNull().unique(),
    parameters: jsonb("parameters").notNull(),
    parameterHash: varchar("parameter_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    state: text("state").notNull(),
    revision: integer("revision").notNull().default(0),
    firstAttemptAt: timestamp("first_attempt_at", {
      withTimezone: true,
      mode: "date",
    }),
    providerId: text("provider_id").unique(),
    providerStatus: text("provider_status"),
    settlementState: text("settlement_state").notNull().default("unobserved"),
    generation: integer("generation").notNull().default(0),
    reconcileAt: timestamp("reconcile_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    unique("order_refund_intents_projection_unique_1").on(
      table.orderId,
      table.actorId,
      table.requestId,
    ),
    check(
      "order_refund_intents_projection_check_1",
      sql.raw("expires_at>created_at"),
    ),
    check(
      "order_refund_intents_projection_check_2",
      sql.raw(
        "state<>'expired' OR (first_attempt_at IS NULL AND provider_id IS NULL)",
      ),
    ),
    check(
      "order_refund_intents_projection_check_3",
      sql.raw("first_attempt_at IS NULL OR first_attempt_at<=expires_at"),
    ),
    check(
      "order_refund_intents_projection_check_4",
      sql.raw("input_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_refund_intents_projection_check_5",
      sql.raw("length(reason) BETWEEN 1 AND 500"),
    ),
    check(
      "order_refund_intents_projection_check_6",
      sql.raw("amount_minor BETWEEN 1 AND 99999999"),
    ),
    check(
      "order_refund_intents_projection_check_7",
      sql.raw("fee_minor BETWEEN 0 AND amount_minor"),
    ),
    check("order_refund_intents_projection_check_8", sql.raw("currency='EUR'")),
    check(
      "order_refund_intents_projection_check_9",
      sql.raw("tax_basis='inclusive_unspecified'"),
    ),
    check(
      "order_refund_intents_projection_check_10",
      sql.raw("platform_account~'^acct_[A-Za-z0-9]+$'"),
    ),
    check(
      "order_refund_intents_projection_check_11",
      sql.raw("payment_intent_id~'^pi_[A-Za-z0-9]+$'"),
    ),
    check(
      "order_refund_intents_projection_check_12",
      sql.raw("charge_id~'^ch_[A-Za-z0-9]+$'"),
    ),
    check(
      "order_refund_intents_projection_check_13",
      sql.raw("connected_account~'^acct_[A-Za-z0-9]+$'"),
    ),
    check(
      "order_refund_intents_projection_check_14",
      sql.raw("api_version='2026-09-30.endive'"),
    ),
    check(
      "order_refund_intents_projection_check_15",
      sql.raw("length(operation_key) BETWEEN 1 AND 200"),
    ),
    check(
      "order_refund_intents_projection_check_16",
      sql.raw("jsonb_typeof(parameters)='object'"),
    ),
    check(
      "order_refund_intents_projection_check_17",
      sql.raw("parameter_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_refund_intents_projection_check_18",
      sql.raw(
        "state IN ('prepared','creating','pending','reconciling','succeeded','remedy_required','expired')",
      ),
    ),
    check("order_refund_intents_projection_check_19", sql.raw("revision>=0")),
    check(
      "order_refund_intents_projection_check_20",
      sql.raw("provider_id IS NULL OR provider_id~'^re_[A-Za-z0-9]+$'"),
    ),
    check(
      "order_refund_intents_projection_check_21",
      sql.raw(
        "provider_status IN ('pending','requires_action','succeeded','failed','canceled')",
      ),
    ),
    check(
      "order_refund_intents_projection_check_22",
      sql.raw(
        "settlement_state IN ('unobserved','verified','reconciling','remedy_required')",
      ),
    ),
    check("order_refund_intents_projection_check_23", sql.raw("generation>=0")),
  ],
);

export const orderRefundLines = treido.table(
  "order_refund_lines",
  {
    intentId: uuid("intent_id").notNull(),
    quoteId: uuid("quote_id").notNull(),
    skuId: uuid("sku_id").notNull(),
    fromQuantity: integer("from_quantity").notNull(),
    quantity: integer("quantity").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    feeMinor: integer("fee_minor").notNull(),
    taxMinor: integer("tax_minor"),
    taxBasis: text("tax_basis").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.intentId, table.skuId] }),
    check("order_refund_lines_projection_check_1", sql.raw("from_quantity>=0")),
    check("order_refund_lines_projection_check_2", sql.raw("quantity>0")),
    check("order_refund_lines_projection_check_3", sql.raw("amount_minor>0")),
    check(
      "order_refund_lines_projection_check_4",
      sql.raw("fee_minor BETWEEN 0 AND amount_minor"),
    ),
    check(
      "order_refund_lines_projection_check_5",
      sql.raw("tax_minor IS NULL"),
    ),
    check(
      "order_refund_lines_projection_check_6",
      sql.raw("tax_basis='inclusive_unspecified'"),
    ),
  ],
);

export const orderRefundObservations = treido.table(
  "order_refund_observations",
  {
    id: uuid("id").primaryKey(),
    intentId: uuid("intent_id").notNull(),
    generation: integer("generation").notNull(),
    providerId: text("provider_id"),
    providerStatus: text("provider_status"),
    amountMinor: integer("amount_minor").notNull(),
    settlementState: text("settlement_state").notNull(),
    refundFact: jsonb("refund_fact").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    unique("order_refund_observations_projection_unique_1").on(
      table.intentId,
      table.generation,
    ),
    check(
      "order_refund_observations_projection_check_1",
      sql.raw("generation>0"),
    ),
    check(
      "order_refund_observations_projection_check_2",
      sql.raw("amount_minor>0"),
    ),
    check(
      "order_refund_observations_projection_check_3",
      sql.raw("jsonb_typeof(refund_fact)='object'"),
    ),
  ],
);

export const orderAftercareOperatorGrants = treido.table(
  "order_aftercare_operator_grants",
  {
    userId: uuid("user_id").notNull(),
    capability: text("capability").notNull(),
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
    primaryKey({
      columns: [
        table.userId,
        table.capability,
        table.environment,
        table.applicationId,
      ],
    }),
    check(
      "order_aftercare_operator_grants_projection_check_1",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "order_aftercare_operator_grants_projection_check_2",
      sql.raw(
        "capability IN ('cases.read','cases.decide','feedback.moderate')",
      ),
    ),
    check(
      "order_aftercare_operator_grants_projection_check_3",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
  ],
);

export const orderAftercareLifecyclePolicies = treido.table(
  "order_aftercare_lifecycle_policies",
  {
    id: uuid("id").primaryKey(),
    version: text("version").notNull(),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    preservesAcceptedEvidence: boolean("preserves_accepted_evidence").notNull(),
    legalHoldsReviewed: boolean("legal_holds_reviewed").notNull(),
    allowRestoreRestriction: boolean("allow_restore_restriction").notNull(),
    retentionDescription: jsonb("retention_description").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvalReference: text("approval_reference").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("order_aftercare_lifecycle_policies_projection_unique_1").on(
      table.environment,
      table.applicationId,
      table.version,
    ),
    check(
      "order_aftercare_lifecycle_policies_projection_check_1",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "order_aftercare_lifecycle_policies_projection_check_2",
      sql.raw("version IN('order-aftercare-v1','order-aftercare-shipping-v2')"),
    ),
    check(
      "order_aftercare_lifecycle_policies_projection_check_3",
      sql.raw("preserves_accepted_evidence"),
    ),
    check(
      "order_aftercare_lifecycle_policies_projection_check_4",
      sql.raw("legal_holds_reviewed"),
    ),
    check(
      "order_aftercare_lifecycle_policies_projection_check_5",
      sql.raw(
        "coalesce(jsonb_typeof(retention_description->'bg')='string' AND jsonb_typeof(retention_description->'en')='string',false)",
      ),
    ),
    check(
      "order_aftercare_lifecycle_policies_projection_check_6",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
  ],
);

export const orderAftercareLegalHolds = treido.table(
  "order_aftercare_legal_holds",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id"),
    orderId: uuid("order_id"),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvalReference: text("approval_reference").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  () => [
    check(
      "order_aftercare_legal_holds_projection_check_1",
      sql.raw("(user_id IS NULL)<>(order_id IS NULL)"),
    ),
    check(
      "order_aftercare_legal_holds_projection_check_2",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "order_aftercare_legal_holds_projection_check_3",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
  ],
);
