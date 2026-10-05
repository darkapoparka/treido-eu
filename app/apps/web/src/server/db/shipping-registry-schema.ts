import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  check,
  uuid,
  integer,
  text,
  boolean,
  jsonb,
  varchar,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
// Literal current shipping column/check projections. Canonical SQL owns FKs, private grants and effect authority.
const treido = pgSchema("treido");
export const orderShippingPolicies = treido.table(
  "order_shipping_policies",
  {
    id: uuid("id").primaryKey(),
    version: integer("version").notNull(),
    basePolicyId: uuid("base_policy_id").notNull(),
    financialPolicyId: uuid("financial_policy_id").notNull(),
    platformAccount: text("platform_account").notNull(),
    livemode: boolean("livemode").notNull(),
    environment: text("environment").notNull(),
    applicationId: text("application_id").notNull(),
    payload: jsonb("payload").notNull(),
    termsHash: varchar("terms_hash", { length: 64 }).notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvalReference: text("approval_reference").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("order_shipping_policies_projection_unique_0").on(
      table.basePolicyId,
      table.version,
    ),
    check("order_shipping_policies_projection_check_0", sql.raw("version>0")),
    check(
      "order_shipping_policies_projection_check_1",
      sql.raw("terms_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_policies_projection_check_2",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
    check(
      "order_shipping_policies_projection_check_3",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "order_shipping_policies_projection_check_4",
      sql.raw(
        "octet_length(payload::text)<=50000 AND payload->>'version'=version::text AND payload->>'basePolicyId'=base_policy_id::text AND payload->>'financialPolicyId'=financial_policy_id::text AND payload->>'platformAccount'=platform_account AND (payload->>'livemode')::boolean=livemode AND payload->>'environment'=environment AND payload->>'applicationId'=application_id",
      ),
    ),
    check(
      "order_shipping_policies_projection_check_5",
      sql.raw(
        "(payload ?& ARRAY['version','basePolicyId','financialPolicyId','platformAccount','livemode','environment','applicationId','countries','fields','requiredFields','recipientPurpose','retentionDescription','terms','rights','refundTerms','taxDescription','taxBasis','shippingRefund','commissionBasis','quoteValidity','reviewSeconds','unacceptedRecipientSeconds','acceptedRecipientSeconds','retentionVersion']) IS TRUE",
      ),
    ),
    check(
      "order_shipping_policies_projection_check_6",
      sql.raw(
        "treido.shipping_localized(payload->'recipientPurpose') AND treido.shipping_localized(payload->'retentionDescription') AND treido.shipping_localized(payload->'terms') AND treido.shipping_localized(payload->'rights') AND treido.shipping_localized(payload->'refundTerms') AND treido.shipping_localized(payload->'taxDescription')",
      ),
    ),
    check(
      "order_shipping_policies_projection_check_7",
      sql.raw(
        "(payload->>'taxBasis' IN('inclusive_known','inclusive_unspecified','exclusive_known') AND payload->>'commissionBasis' IN('merchandise','merchandise_and_shipping') AND payload->>'quoteValidity'='original_allocation_within_tariff' AND payload->>'retentionVersion'='order-shipping-v1' AND (payload->>'reviewSeconds')::integer BETWEEN 60 AND 3600 AND (payload->>'unacceptedRecipientSeconds')::integer BETWEEN (payload->>'reviewSeconds')::integer AND 31536000 AND (payload->>'acceptedRecipientSeconds')::integer BETWEEN 60 AND 315360000) IS TRUE",
      ),
    ),
    check(
      "order_shipping_policies_projection_check_8",
      sql.raw(
        "(payload->'shippingRefund' ?& ARRAY['beforeDispatch','afterDispatch','return'] AND payload->'shippingRefund'->>'beforeDispatch' IN('refundable','not_refundable') AND payload->'shippingRefund'->>'afterDispatch' IN('refundable','not_refundable') AND payload->'shippingRefund'->>'return' IN('refundable','not_refundable')) IS TRUE",
      ),
    ),
  ],
);
export const orderShippingCarriers = treido.table(
  "order_shipping_carriers",
  {
    id: uuid("id").primaryKey(),
    policyId: uuid("policy_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull(),
    bindingHash: varchar("binding_hash", { length: 64 }).notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvalReference: text("approval_reference").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("order_shipping_carriers_projection_unique_0").on(
      table.policyId,
      table.sellerId,
      table.version,
    ),
    unique("order_shipping_carriers_projection_unique_1").on(
      table.id,
      table.policyId,
    ),
    check("order_shipping_carriers_projection_check_0", sql.raw("version>0")),
    check(
      "order_shipping_carriers_projection_check_1",
      sql.raw("binding_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_carriers_projection_check_2",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
    check(
      "order_shipping_carriers_projection_check_3",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "order_shipping_carriers_projection_check_4",
      sql.raw(
        "(octet_length(payload::text)<=10000 AND payload->>'policyId'=policy_id::text AND payload->>'sellerId'=seller_id::text AND payload->>'version'=version::text AND payload->>'country'~'^[A-Z]{2}$' AND payload->>'method' IN('address','collection_office') AND payload->>'sourceKind'='approved_seller_tariff' AND length(payload->>'carrierCode') BETWEEN 1 AND 80 AND treido.shipping_localized(payload->'carrierLabel')) IS TRUE",
      ),
    ),
    check(
      "order_shipping_carriers_projection_check_5",
      sql.raw(
        "(CASE payload->>'method' WHEN 'address' THEN payload->'officeCodes'='null'::jsonb WHEN 'collection_office' THEN jsonb_typeof(payload->'officeCodes')='array' AND jsonb_array_length(payload->'officeCodes') BETWEEN 1 AND 100 ELSE false END) IS TRUE",
      ),
    ),
  ],
);
export const orderShippingRates = treido.table(
  "order_shipping_rates",
  {
    id: uuid("id").primaryKey(),
    policyId: uuid("policy_id").notNull(),
    carrierBindingId: uuid("carrier_binding_id").notNull(),
    version: integer("version").notNull(),
    payload: jsonb("payload").notNull(),
    rateHash: varchar("rate_hash", { length: 64 }).notNull(),
    validUntil: timestamp("valid_until", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvalReference: text("approval_reference").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    unique("order_shipping_rates_projection_unique_0").on(
      table.carrierBindingId,
      table.version,
    ),
    check("order_shipping_rates_projection_check_0", sql.raw("version>0")),
    check(
      "order_shipping_rates_projection_check_1",
      sql.raw("rate_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_rates_projection_check_2",
      sql.raw("length(approval_reference) BETWEEN 1 AND 200"),
    ),
    check(
      "order_shipping_rates_projection_check_3",
      sql.raw("revoked_at IS NULL OR revoked_at>=approved_at"),
    ),
    check(
      "order_shipping_rates_projection_check_4",
      sql.raw("valid_until>approved_at"),
    ),
    check(
      "order_shipping_rates_projection_check_5",
      sql.raw(
        "(octet_length(payload::text)<=10000 AND payload->>'bindingId'=carrier_binding_id::text AND payload->>'version'=version::text AND (payload->>'validUntil')::timestamptz=valid_until AND (payload->>'shippingMinor')::integer BETWEEN 0 AND 99999999 AND (payload->>'buyerFeeMinor')::integer BETWEEN 0 AND 99999999 AND (payload->>'maximumUnits')::integer BETWEEN 1 AND 3000000 AND (payload->>'maximumMerchandiseMinor')::integer BETWEEN 1 AND 99999999 AND length(payload->>'sourceReference') BETWEEN 1 AND 200) IS TRUE",
      ),
    ),
    check(
      "order_shipping_rates_projection_check_6",
      sql.raw(
        "((payload->>'taxBasis'='inclusive_unspecified' AND payload->'taxMinor'='null'::jsonb AND payload->'sourceHash'='null'::jsonb AND payload->'merchandiseMinor'='null'::jsonb) OR (payload->>'taxBasis' IN('inclusive_known','exclusive_known') AND (payload->>'taxMinor')::integer BETWEEN 0 AND 99999999 AND payload->>'sourceHash'~'^[a-f0-9]{64}$' AND (payload->>'merchandiseMinor')::integer BETWEEN 1 AND 99999999)) IS TRUE",
      ),
    ),
  ],
);
