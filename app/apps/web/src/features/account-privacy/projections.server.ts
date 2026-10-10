import "server-only";
import { ownSupportExport } from "../support/export.server";
import type { PoolClient } from "pg";
import {
  PRIVACY_LIMITS,
  PrivacyError,
  type ClosureFacts,
  type ExportCategory,
} from "./model";
import { snapshotSection } from "./snapshot";
import { readOwnAccountLifecycleExport } from "../account-closure/queries.server";
import { ownAssistantInputExport } from "../assistant-runs/export.server";
import { readAftercareOwnExport } from "../order-aftercare/queries.server";
import { readFeedbackOwnExport } from "../order-feedback/queries.server";
import { readShippingOwnExport } from "../order-shipping/recipient.server";
import { ownCommunicationMetadata } from "./communication-export.server";
type Query = Pick<PoolClient, "query">;
/** Fixed, explicit columns. Nothing reads provider payloads, private counterpart evidence or tables wholesale. */
export const EXPORT_SQL: Record<ExportCategory, string> = {
  account: `SELECT id,status,created_at AS "createdAt" FROM treido.users WHERE id=$1 LIMIT $2`,
  personalProfile: `SELECT s.id AS "sellerId",s.name,p.description,p.locality
    FROM treido.personal_seller_owners o JOIN treido.seller_accounts s ON s.id=o.seller_id
    LEFT JOIN treido.seller_profiles p ON p.seller_id=s.id WHERE o.user_id=$1 ORDER BY s.id LIMIT $2`,
  memberships: `SELECT seller_id AS "sellerId",role,status,revision FROM treido.seller_memberships
    WHERE user_id=$1 ORDER BY seller_id LIMIT $2`,
  library: `SELECT kind,"resourceId",name,active,"recordedAt" FROM (
    SELECT 'savedListing' AS kind,listing_id AS "resourceId",NULL::text AS name,saved AS active,saved_at AS "recordedAt" FROM treido.saved_listings WHERE user_id=$1
    UNION ALL SELECT 'collection',id,name,active,created_at FROM treido.buyer_collections WHERE user_id=$1
    UNION ALL SELECT 'follow',seller_id,NULL::text,followed,followed_at FROM treido.seller_follows WHERE user_id=$1
    ) owned ORDER BY "recordedAt" DESC,kind,"resourceId" LIMIT $2`,
  cart: `SELECT listing_id AS "listingId",sku_id AS "skuId",quantity,active,added_at AS "addedAt"
    FROM treido.buyer_cart_lines WHERE user_id=$1 ORDER BY added_at DESC,sku_id LIMIT $2`,
  searches: `SELECT s.id,s.name,s.status,s.criteria_version AS version,s.consent_generation AS generation,s.frequency_minutes AS "frequencyMinutes",
    s.consent_at AS "consentAt",v.criteria->>'mode' AS "criteriaMode",(v.criteria->>'registry')::int AS "criteriaRegistry",v.criteria->>'query' AS "criteriaQuery"
    FROM treido.buyer_saved_searches s LEFT JOIN treido.buyer_saved_search_versions v
      ON v.user_id=s.user_id AND v.search_id=s.id AND v.version=s.criteria_version
    WHERE s.user_id=$1 ORDER BY s.created_at DESC,s.id LIMIT $2`,
  purchases: `SELECT kind,id,state,"fulfilmentState","settlementState",currency,"totalMinor","createdAt" FROM (
    SELECT 'paymentAttempt' AS kind,a.id,a.state,NULL::text AS "fulfilmentState",NULL::text AS "settlementState",
      q.currency,q.total_minor AS "totalMinor",a.created_at AS "createdAt"
    FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id AND q.seller_id=a.seller_id WHERE q.buyer_id=$1
    UNION ALL SELECT 'order',o.id,o.payment_state,o.fulfilment_state,o.settlement_state,q.currency,q.total_minor,o.created_at
    FROM treido.paid_orders o JOIN treido.payable_quotes q ON q.id=o.quote_id AND q.buyer_id=o.buyer_id AND q.seller_id=o.seller_id WHERE o.buyer_id=$1
    ) owned ORDER BY "createdAt" DESC,kind,id LIMIT $2`,
};
/** Supplied buyer context and retry metadata only. Historical publication snapshots
 * may contain withdrawn content, so this export never selects their titles/media. */
async function projectSearchData(client: Query, userId: string) {
  const optional = (
    await client.query<{
      gift: number;
      compatibility: number;
      measurement: boolean;
    }>(`SELECT
      (SELECT count(*)::int FROM unnest(ARRAY['buyer_gift_workspaces','buyer_gift_observations','buyer_gift_receipts']) name WHERE to_regclass('treido.'||name) IS NOT NULL) AS gift,
      (SELECT count(*)::int FROM unnest(ARRAY['buyer_compatibility_workspaces','buyer_compatibility_observations','buyer_compatibility_receipts']) name WHERE to_regclass('treido.'||name) IS NOT NULL) AS compatibility,
      to_regclass('treido.promotion_measurement_choices') IS NOT NULL AS measurement`)
  ).rows[0];
  if (
    !optional ||
    ![0, 3].includes(optional.gift) ||
    ![0, 3].includes(optional.compatibility)
  )
    throw new PrivacyError("NOT_AVAILABLE");
  const sources = [
    `SELECT 'savedSearch'::text AS kind,id,name,status,version,generation,"frequencyMinutes","consentAt","criteriaMode","criteriaRegistry","criteriaQuery",
      NULL::text AS context,NULL::text AS selection,NULL::uuid AS "listingId",NULL::integer AS "publicationRevision",NULL::uuid AS "skuId",
      NULL::text AS operation,NULL::text AS "inputHash",NULL::timestamptz AS "recordedAt",0 AS priority
      FROM (${EXPORT_SQL.searches}) saved`,
  ];
  if (optional.gift === 3)
    sources.push(
      `SELECT 'giftWorkspace',user_id,NULL,NULL,revision,NULL,NULL,NULL,'gift-finder',NULL,NULL,
      brief::text,array_to_string(selected_ids,','),NULL,NULL,NULL,NULL,NULL,updated_at,0
      FROM treido.buyer_gift_workspaces WHERE user_id=$1`,
      `SELECT 'giftObservation',listing_id,NULL,NULL,NULL,NULL,NULL,NULL,'gift-finder',NULL,NULL,
      NULL,NULL,listing_id,publication_revision,sku_id,NULL,NULL,observed_at,1
      FROM treido.buyer_gift_observations WHERE user_id=$1`,
      `SELECT 'giftReceipt',request_id,NULL,NULL,accepted_revision,NULL,NULL,NULL,'gift-finder',NULL,NULL,
      NULL,NULL,NULL,NULL,NULL,operation,input_hash,created_at,2
      FROM treido.buyer_gift_receipts WHERE user_id=$1`,
    );
  if (optional.compatibility === 3)
    sources.push(
      `SELECT 'compatibilityWorkspace',user_id,NULL,NULL,revision,NULL,NULL,NULL,'compatibility',NULL,NULL,
      requirements::text,NULL,NULL,NULL,NULL,NULL,NULL,updated_at,0
      FROM treido.buyer_compatibility_workspaces WHERE user_id=$1`,
      `SELECT 'compatibilityObservation',listing_id,NULL,NULL,NULL,NULL,NULL,NULL,'compatibility',NULL,NULL,
      NULL,NULL,listing_id,publication_revision,sku_id,NULL,NULL,observed_at,1
      FROM treido.buyer_compatibility_observations WHERE user_id=$1`,
      `SELECT 'compatibilityReceipt',request_id,NULL,NULL,accepted_revision,NULL,NULL,NULL,'compatibility',NULL,NULL,
      NULL,NULL,NULL,NULL,NULL,operation,input_hash,created_at,2
      FROM treido.buyer_compatibility_receipts WHERE user_id=$1`,
    );
  if (optional?.measurement)
    sources.push(`SELECT 'promotionMeasurementChoice',request_id,NULL,
      CASE WHEN allowed THEN 'enabled' ELSE 'paused' END,revision,NULL,NULL,created_at,'promotion-measurement',NULL,NULL,
      jsonb_build_object('policyId',policy_id,'allowed',allowed)::text,NULL,NULL,NULL,NULL,'choice',input_hash,created_at,0
      FROM (SELECT DISTINCT ON(policy_id) policy_id,request_id,allowed,revision,input_hash,created_at
        FROM treido.promotion_measurement_choices WHERE user_id=$1
        ORDER BY policy_id,revision DESC) current_choices`);
  const rows = (
    await client.query<Record<string, unknown>>(
      `SELECT * FROM (${sources.join(" UNION ALL ")}) owned
      ORDER BY priority,"recordedAt" DESC NULLS LAST,kind,id LIMIT $2`,
      [userId, PRIVACY_LIMITS.rows + 1],
    )
  ).rows;
  const inputs = await ownAssistantInputExport({ client }, userId);
  const inputRows: Record<string, unknown>[] = inputs.map((input) => ({
    kind: input.kind,
    status: input.state,
    criteriaMode: `assistant-${input.mode}`,
    criteriaQuery: input.criteria,
    generation: input.consentGeneration,
    consentAt: input.consentUpdatedAt,
    processingConsent: input.consent,
    processingConsentExpiresAt: input.consentExpiresAt,
    recordedAt: input.createdAt,
  }));
  return inputRows.concat(rows);
}
async function projectPurchaseData(
  client: Query,
  userId: string,
  rows: Record<string, unknown>[],
) {
  const present = (
    await client.query<{
      aftercare: number;
      feedback: number;
      shipping: number;
    }>(`SELECT
    (SELECT count(*)::int FROM unnest(ARRAY['order_cases','order_refund_intents']) name WHERE to_regclass('treido.'||name) IS NOT NULL) AS aftercare,
    (SELECT count(*)::int FROM unnest(ARRAY['order_feedback_policies','order_purchase_feedback','order_feedback_events','order_feedback_receipts']) name WHERE to_regclass('treido.'||name) IS NOT NULL) AS feedback,
    (SELECT count(*)::int FROM unnest(ARRAY['order_shipping_policies','order_shipping_carriers','order_shipping_rates','order_shipping_choices','order_shipping_recipients','order_shipping_receipts']) name WHERE to_regclass('treido.'||name) IS NOT NULL) AS shipping`)
  ).rows[0];
  if (
    !present ||
    ![0, 2].includes(present.aftercare) ||
    ![0, 4].includes(present.feedback) ||
    ![0, 6].includes(present.shipping)
  )
    throw new PrivacyError("NOT_AVAILABLE");
  const summaries: Record<string, unknown>[] = [];
  let limited = false;
  if (present.aftercare === 2) {
    const aftercare = await readAftercareOwnExport(client, userId);
    summaries.push(
      ...aftercare.cases.map((row) => ({ kind: "orderSupportCase", ...row })),
      ...aftercare.refundRequests.map((row) => ({
        kind: "orderRefundRequest",
        ...row,
      })),
    );
    limited ||= aftercare.more;
  }
  if (present.feedback === 4) {
    const feedback = await readFeedbackOwnExport(client, userId);
    summaries.push(
      ...feedback.feedback.map((row) => ({ kind: "orderFeedback", ...row })),
      ...feedback.receipts.map((row) => ({
        kind: "orderFeedbackReceipt",
        ...row,
      })),
    );
    limited ||= feedback.more;
  }
  if (present.shipping === 6) {
    const shipping = await readShippingOwnExport(client, userId);
    summaries.push(
      ...shipping.choices.map((row) => ({ kind: "shippingChoice", ...row })),
    );
    limited ||= shipping.more;
  }
  return { rows: rows.concat(summaries), limited };
}
export async function projectExport(
  client: Query,
  userId: string,
  categories: ExportCategory[],
) {
  const sections = [];
  for (const category of categories) {
    let additionalLimited = false;
    let rows =
      category === "searches"
        ? await projectSearchData(client, userId)
        : (
            await client.query<Record<string, unknown>>(EXPORT_SQL[category], [
              userId,
              PRIVACY_LIMITS.rows + 1,
            ])
          ).rows;
    if (category === "account") {
      rows = rows.concat(await readOwnAccountLifecycleExport(client, userId));
      rows = rows.concat(await ownCommunicationMetadata(client, userId));
      rows = rows.concat(await ownSupportExport(client, userId));
    }
    if (category === "purchases") {
      const purchases = await projectPurchaseData(client, userId, rows);
      rows = purchases.rows;
      additionalLimited = purchases.limited;
    }
    const section = snapshotSection(category, rows);
    section.limited ||= additionalLimited;
    sections.push(section);
  }
  return sections;
}
/** Counts are review information only. Zero counts never authorize account destruction. */
export async function readClosureFacts(
  client: Query,
  userId: string,
): Promise<ClosureFacts> {
  const row = (
    await client.query<ClosureFacts>(
      `
    WITH scope AS (
      SELECT seller_id FROM treido.personal_seller_owners WHERE user_id=$1
      UNION SELECT seller_id FROM treido.seller_memberships WHERE user_id=$1 AND status='active' AND role='owner'
    ) SELECT
    (SELECT count(*)::int FROM treido.listings l JOIN treido.personal_seller_owners o ON o.seller_id=l.seller_id WHERE o.user_id=$1 AND l.publication='published') AS "personalListings",
    (SELECT count(*)::int FROM treido.seller_memberships WHERE user_id=$1 AND status='active') AS "businessMemberships",
    (SELECT count(*)::int FROM treido.seller_memberships m WHERE m.user_id=$1 AND m.status='active' AND m.role='owner'
      AND NOT EXISTS(SELECT 1 FROM treido.seller_memberships other WHERE other.seller_id=m.seller_id AND other.user_id<>$1 AND other.status='active' AND other.role='owner')) AS "soleBusinessOwnerships",
    (SELECT count(*)::int FROM treido.inventory_allocations a WHERE (a.buyer_id=$1 OR a.seller_id IN(SELECT seller_id FROM scope)) AND a.state IN('active','reconciliation')) AS allocations,
    (SELECT count(*)::int FROM treido.listing_offers o WHERE (o.buyer_id=$1 OR o.seller_id IN(SELECT seller_id FROM scope)) AND o.state IN('pending','accepted')) AS offers,
    (SELECT count(*)::int FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id AND q.seller_id=a.seller_id
      WHERE (q.buyer_id=$1 OR a.seller_id IN(SELECT seller_id FROM scope)) AND a.state NOT IN('cancelled','paid')) AS "paymentAttempts",
    (SELECT count(*)::int FROM treido.paid_orders o WHERE (o.buyer_id=$1 OR o.seller_id IN(SELECT seller_id FROM scope))
      AND (o.payment_state IN('refund_pending','disputed','reconciliation') OR (o.payment_state<>'refunded' AND o.fulfilment_state<>'collected') OR o.settlement_state='reconciliation')) AS orders,
    (SELECT count(*)::int FROM treido.payment_refunds r JOIN treido.paid_orders o ON o.id=r.order_id AND o.seller_id=r.seller_id
      WHERE (o.buyer_id=$1 OR r.seller_id IN(SELECT seller_id FROM scope)) AND r.state NOT IN('succeeded','failed')) AS refunds,
    (SELECT count(*)::int FROM treido.reports WHERE reporter_id=$1 AND state='open') AS "openReports"
  `,
      [userId],
    )
  ).rows[0];
  return row;
}
