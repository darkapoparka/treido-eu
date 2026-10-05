import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  check,
  uuid,
  jsonb,
  varchar,
  text,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
// Literal current shipping column/check projections. Canonical SQL owns FKs, private grants and effect authority.
const treido = pgSchema("treido");
export const orderShippingChoices = treido.table(
  "order_shipping_choices",
  {
    id: uuid("id").primaryKey(),
    buyerId: uuid("buyer_id").notNull(),
    sellerId: uuid("seller_id").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    snapshotHash: varchar("snapshot_hash", { length: 64 }).notNull(),
    state: text("state").notNull().default("reviewed"),
    revision: integer("revision").notNull().default(0),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    boundAt: timestamp("bound_at", { withTimezone: true, mode: "date" }),
    quoteId: uuid("quote_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "order_shipping_choices_projection_check_0",
      sql.raw("snapshot_hash~'^[a-f0-9]{64}$'"),
    ),
    check(
      "order_shipping_choices_projection_check_1",
      sql.raw("state IN('reviewed','accepted','bound')"),
    ),
    check(
      "order_shipping_choices_projection_check_2",
      sql.raw("revision BETWEEN 0 AND 2"),
    ),
    check(
      "order_shipping_choices_projection_check_3",
      sql.raw(
        "(octet_length(snapshot::text)<=150000 AND snapshot->>'format'='goods-shipping-v1' AND snapshot->>'currency'='EUR' AND snapshot->>'language' IN('bg','en') AND snapshot->>'sellerId'=seller_id::text AND snapshot->>'sourceHash'~'^[a-f0-9]{64}$' AND jsonb_typeof(snapshot->'lines')='array' AND jsonb_array_length(snapshot->'lines') BETWEEN 1 AND 30) IS TRUE",
      ),
    ),
    check(
      "order_shipping_choices_projection_check_4",
      sql.raw("expires_at>created_at"),
    ),
    check(
      "order_shipping_choices_projection_check_5",
      sql.raw(
        "accepted_at IS NULL OR accepted_at BETWEEN created_at AND expires_at",
      ),
    ),
    check(
      "order_shipping_choices_projection_check_6",
      sql.raw(
        "(state='reviewed' AND revision=0 AND accepted_at IS NULL AND quote_id IS NULL AND bound_at IS NULL) OR (state='accepted' AND revision=1 AND accepted_at IS NOT NULL AND quote_id IS NULL AND bound_at IS NULL) OR (state='bound' AND revision=2 AND accepted_at IS NOT NULL AND quote_id IS NOT NULL AND bound_at BETWEEN accepted_at AND expires_at)",
      ),
    ),
  ],
);
export const orderShippingRecipients = treido.table(
  "order_shipping_recipients",
  {
    choiceId: uuid("choice_id").primaryKey(),
    buyerId: uuid("buyer_id").notNull(),
    value: jsonb("value"),
    retainUntil: timestamp("retain_until", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    clearedAt: timestamp("cleared_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "order_shipping_recipients_projection_check_0",
      sql.raw(
        "value IS NULL OR (jsonb_typeof(value)='object' AND octet_length(value::text)<=2000)",
      ),
    ),
    check(
      "order_shipping_recipients_projection_check_1",
      sql.raw("(value IS NULL)=(cleared_at IS NOT NULL)"),
    ),
    check(
      "order_shipping_recipients_projection_check_2",
      sql.raw("retain_until>created_at"),
    ),
  ],
);
export const orderShippingReceipts = treido.table(
  "order_shipping_receipts",
  {
    buyerId: uuid("buyer_id").notNull(),
    requestId: uuid("request_id").notNull(),
    choiceId: uuid("choice_id"),
    inputHash: varchar("input_hash", { length: 64 }),
    action: text("action").notNull(),
    acceptedRevision: integer("accepted_revision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  (table) => [
    primaryKey({ columns: [table.buyerId, table.requestId] }),
    check(
      "order_shipping_receipts_projection_check_0",
      sql.raw("action IN('prepare','accept','abandoned')"),
    ),
    check(
      "order_shipping_receipts_projection_check_1",
      sql.raw(
        "(action='abandoned' AND choice_id IS NULL AND input_hash IS NULL AND accepted_revision=0) OR (action IN('prepare','accept') AND choice_id IS NOT NULL AND input_hash~'^[a-f0-9]{64}$' AND accepted_revision=CASE action WHEN 'prepare' THEN 0 ELSE 1 END)",
      ),
    ),
  ],
);
