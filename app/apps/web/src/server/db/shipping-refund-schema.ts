import "server-only";
import { sql } from "drizzle-orm";
import {
  pgSchema,
  check,
  uuid,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
// Literal current shipping column/check projections. Canonical SQL owns FKs, private grants and effect authority.
const treido = pgSchema("treido");
export const orderRefundShippingComponents = treido.table(
  "order_refund_shipping_components",
  {
    intentId: uuid("intent_id").primaryKey(),
    quoteId: uuid("quote_id").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    feeMinor: integer("fee_minor").notNull(),
    taxBasis: text("tax_basis").notNull(),
    fulfilmentStage: text("fulfilment_stage").notNull(),
    fulfilmentRevision: integer("fulfilment_revision").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql.raw("clock_timestamp()")),
  },
  () => [
    check(
      "order_refund_shipping_components_projection_check_0",
      sql.raw("amount_minor BETWEEN 1 AND 99999999"),
    ),
    check(
      "order_refund_shipping_components_projection_check_1",
      sql.raw("fee_minor BETWEEN 0 AND amount_minor"),
    ),
    check(
      "order_refund_shipping_components_projection_check_2",
      sql.raw("tax_basis='inclusive_unspecified'"),
    ),
    check(
      "order_refund_shipping_components_projection_check_3",
      sql.raw("fulfilment_stage IN('before_dispatch','after_dispatch')"),
    ),
    check(
      "order_refund_shipping_components_projection_check_4",
      sql.raw("fulfilment_revision>=0"),
    ),
  ],
);
