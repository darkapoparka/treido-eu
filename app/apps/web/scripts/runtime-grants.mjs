import { applyBillingRecoveryGrants } from "../src/features/seller-billing/recovery-runtime-grants.mjs";
import { applyInvitationMailGrants } from "../src/features/team/runtime-grants.mjs";
import { applyMessageAttachmentGrants } from "../src/features/message-attachments/runtime-grants.mjs";
import { applyMessageImageLifecycleGrants } from "../src/features/message-attachments/lifecycle-grants.mjs";
import { applyOrderShippingGrants } from "../src/features/order-shipping/runtime-grants.mjs";
import { applyShippingRetentionGrants } from "../src/features/order-aftercare/shipping-retention-grants.mjs";
import { applyShippingIntegrationGrants } from "../src/server/jobs/shipping-grants.mjs";
import { applyAssistantInputGrants } from "../src/features/assistant-runs/runtime-grants.mjs";
import { applyOrderAftercareGrants } from "../src/features/order-aftercare/runtime-grants.mjs";
import { applyOrderFeedbackGrants } from "../src/features/order-feedback/runtime-grants.mjs";
import { applyAccountClosureGrants } from "../src/features/account-closure/closure-grants.mjs";
import { applyAftercareClosureGrants } from "../src/features/order-aftercare/closure-grants.mjs";
import { applyLifecycleJobGrants } from "../src/server/jobs/lifecycle-grants.mjs";
/** Same reviewed least-privilege data grants for isolated migrations and native QA. */
import { applyTrustCaseGrants } from "./trust-case-grants.mjs";
import { applyShoppingToolsGrants } from "./shopping-tools-grants.mjs";
import { applySavedSearchGrants } from "./saved-search-grants.mjs";
import { applyAssistantToolsGrants } from "../src/features/assistant-tools/runtime-grants.mjs";
import { applySellerBillingGrants } from "../src/features/seller-billing/runtime-grants.mjs";
import { applyPromotionGrants } from "../src/features/promotions/promotions-grants.mjs";
import { applyPromotionPaymentGrants } from "../src/features/seller-billing/promotion-runtime-grants.mjs";
import { applyGiftFinderGrants } from "../src/features/gift-finder/runtime-grants.mjs";
import { applyAccountPrivacyGrants } from "../src/features/account-privacy/privacy-grants.mjs";

export async function applyRuntimeGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const name = `"${role}"`;
  await client.query(
    `GRANT USAGE ON SCHEMA treido TO ${name}; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA treido TO ${name}`,
  );
  await client.query(`REVOKE UPDATE ON treido.seller_declarations,treido.seller_setup_receipts,treido.job_redrives,
    treido.outbox_jobs,treido.job_effects,treido.media_assets FROM ${name}`);
  await client.query(`GRANT UPDATE (state,generation,attempts,available_at,dispatch_token,dispatch_until,executor_event_id,
    accepted_at,progress_at,completed_at,last_error) ON treido.outbox_jobs TO ${name}`);
  await client.query(`GRANT UPDATE (state,execution_token,execution_until,executor_run_id,provider_object_id,result_id,completed_at)
    ON treido.job_effects TO ${name}`);
  await client.query(`GRANT UPDATE (state,immutable_key,source_etag,derivative_key,derivative_checksum,width,height,
    position,revision,job_id,error_code,expires_at,storage_scope) ON treido.media_assets TO ${name}`);
  await client.query(
    `REVOKE INSERT,UPDATE,DELETE ON treido.category_registry_versions,treido.categories,treido.category_policies FROM ${name}`,
  );
  await client.query(`REVOKE INSERT,UPDATE,DELETE ON treido.operator_grants FROM ${name};
    GRANT EXECUTE ON FUNCTION treido.lock_operator_grant(uuid,text) TO ${name};
    REVOKE UPDATE ON treido.messages,treido.message_attachment_links FROM ${name}`);
  await client.query(
    `REVOKE UPDATE,DELETE ON treido.moderation_actions,treido.moderation_appeals,treido.listing_withdrawal_receipts,treido.listing_duplicate_receipts,treido.contact_preference_receipts,treido.message_notification_intents FROM ${name}`,
  );
  await client.query(
    `REVOKE UPDATE,DELETE ON treido.buyer_library_receipts FROM ${name}`,
  );
  await client.query(`REVOKE UPDATE ON treido.buyer_libraries,treido.saved_listings,treido.buyer_collections,treido.buyer_collection_items,treido.seller_follows FROM ${name};
    GRANT UPDATE(revision) ON treido.buyer_libraries TO ${name};
    GRANT UPDATE(saved,saved_at) ON treido.saved_listings TO ${name};
    GRANT UPDATE(name,active) ON treido.buyer_collections TO ${name};
    GRANT UPDATE(included) ON treido.buyer_collection_items TO ${name};
    GRANT UPDATE(followed,followed_at) ON treido.seller_follows TO ${name}`);
  await client.query(
    `REVOKE UPDATE,DELETE ON treido.listing_publications,treido.listing_publication_media FROM ${name}; GRANT EXECUTE ON FUNCTION treido.lock_publication_policy(integer,text,text,integer) TO ${name}`,
  );
  await client.query(
    `REVOKE UPDATE,DELETE ON treido.inventory_batch_receipts,treido.inventory_publications,treido.inventory_publication_skus,treido.inventory_allocation_lines,treido.inventory_events,treido.inventory_command_receipts,treido.buyer_cart_receipts,treido.offer_events,treido.offer_command_receipts FROM ${name}`,
  );
  await client.query(`REVOKE UPDATE ON treido.inventory_catalogues,treido.inventory_skus,treido.inventory_allocations,treido.buyer_carts,treido.buyer_cart_lines,treido.listing_offers FROM ${name};
    GRANT UPDATE(revision) ON treido.inventory_catalogues TO ${name};
    GRANT UPDATE(seller_sku,options,option_key,price_minor,on_hand,sold,active,revision) ON treido.inventory_skus TO ${name};
    GRANT UPDATE(state,revision,resolution_reference,updated_at) ON treido.inventory_allocations TO ${name};
    GRANT UPDATE(revision) ON treido.buyer_carts TO ${name};
    GRANT UPDATE(publication_revision,quantity,seen_price_minor,active,added_at) ON treido.buyer_cart_lines TO ${name};
    GRANT UPDATE(state,revision,allocation_id) ON treido.listing_offers TO ${name}`);
  await client.query(`REVOKE UPDATE,DELETE ON treido.catalogue_import_chunks,treido.catalogue_external_ids,treido.catalogue_import_receipts FROM ${name};
    REVOKE UPDATE ON treido.catalogue_imports,treido.catalogue_import_rows FROM ${name};
    GRANT UPDATE(state,revision,total_rows,job_id,error_code,updated_at) ON treido.catalogue_imports TO ${name};
    GRANT UPDATE(external_id,raw,payload,inventory,errors,selected,state,listing_id) ON treido.catalogue_import_rows TO ${name};
    GRANT DELETE ON treido.catalogue_import_chunks TO ${name}`);
  await client.query(`REVOKE UPDATE,DELETE ON treido.media_storage_objects FROM ${name};
    GRANT UPDATE(state,write_until,retain_until,available_at,deletion_token,deletion_until,attempts,deleted_at) ON treido.media_storage_objects TO ${name}`);
  await client.query(`REVOKE UPDATE,DELETE ON treido.personal_profile_receipts,treido.team_command_receipts,treido.seller_service_receipts FROM ${name};
    REVOKE UPDATE ON treido.seller_team_state,treido.seller_invitations,treido.invitation_deliveries,treido.seller_service_settings FROM ${name};
    GRANT UPDATE(revision) ON treido.seller_team_state TO ${name};
    GRANT UPDATE(status,revision,accepted_by,accepted_membership_revision,accepted_at,declined_by,declined_at) ON treido.seller_invitations TO ${name};
    GRANT UPDATE(state,provider_id,request_payload,first_attempt_at,submitted_at) ON treido.invitation_deliveries TO ${name};
    GRANT UPDATE(revision,payload,updated_by,updated_at) ON treido.seller_service_settings TO ${name}`);
  await client.query(`REVOKE UPDATE,DELETE ON treido.purchase_reviews,treido.purchase_review_lines,treido.purchase_review_receipts FROM ${name};
    REVOKE UPDATE ON treido.purchase_review_preferences FROM ${name};
    GRANT UPDATE(revision,note,archived,updated_at) ON treido.purchase_review_preferences TO ${name}`);
  await client.query(`REVOKE UPDATE,DELETE ON treido.purchase_review_renewals,treido.merchant_inquiry_receipts,treido.reservation_cancellation_receipts FROM ${name};
    REVOKE UPDATE,DELETE ON treido.merchant_inquiry_state FROM ${name};
    GRANT UPDATE(status,revision,updated_by,updated_at) ON treido.merchant_inquiry_state TO ${name}`);
  await client.query(`REVOKE INSERT,UPDATE,DELETE ON treido.payment_policies,treido.seller_payment_bindings,treido.payable_listing_terms FROM ${name};
    REVOKE UPDATE,DELETE ON treido.payable_quotes,treido.payable_quote_lines,treido.stripe_webhook_receipts,treido.payment_facts,treido.paid_order_receipts FROM ${name};
    REVOKE UPDATE,DELETE ON treido.payment_attempts,treido.payment_refunds,treido.paid_orders,treido.connect_onboarding_intents FROM ${name};
    GRANT UPDATE(state,provider_id,cancel_requested,first_attempt_at,observed_at,reconcile_at,updated_at) ON treido.payment_attempts TO ${name};
    GRANT UPDATE(state,provider_id,first_attempt_at,reconcile_at,updated_at) ON treido.payment_refunds TO ${name};
    GRANT UPDATE(payment_state,fulfilment_state,settlement_state,revision,updated_at) ON treido.paid_orders TO ${name};
    GRANT UPDATE(state) ON treido.connect_onboarding_intents TO ${name}`);
  await client.query(
    `GRANT EXECUTE ON FUNCTION treido.lock_payment_policy(uuid,text,boolean,text,text),treido.lock_seller_payment_binding(uuid,text,boolean),treido.lock_payable_listing_terms(uuid,uuid,integer,uuid) TO ${name}`,
  );
  // Keep the case/action history immutable after the initial broad data grants.
  await applyTrustCaseGrants(client, role);
  await applyShoppingToolsGrants(client, role);
  await applySavedSearchGrants(client, role);
  await applyAssistantToolsGrants(client, role);
  await applyAccountPrivacyGrants(client, role);
  await applyGiftFinderGrants(client, role);
  await applySellerBillingGrants(client, role);
  await applyPromotionGrants(client, role);
  await applyPromotionPaymentGrants(client, role);
  await applyAssistantInputGrants(client, role);
  await applyOrderAftercareGrants(client, role);
  await applyOrderFeedbackGrants(client, role);
  await applyAccountClosureGrants(client, role);
  await applyAftercareClosureGrants(client, role);
  await applyLifecycleJobGrants(client, role);
  await applyOrderShippingGrants(client, role);
  await applyShippingRetentionGrants(client, role);
  await applyShippingIntegrationGrants(client, role);
  // Historical isolated suites retain their declared migration baselines.
  // Current installs always apply these restrictions after the broad data grants.
  const mail = await client.query(
    "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='treido' AND table_name='invitation_deliveries' AND column_name='mail_binding') AS ready",
  );
  if (mail.rows[0]?.ready) await applyInvitationMailGrants(client, role);
  const attachments = await client.query(
    "SELECT to_regclass('treido.message_attachment_objects') IS NOT NULL AS ready",
  );
  if (attachments.rows[0]?.ready)
    await applyMessageAttachmentGrants(client, role);
  const imageLifecycle = await client.query(
    "SELECT to_regclass('treido.message_image_lifecycle_policies') IS NOT NULL AS ready",
  );
  if (imageLifecycle.rows[0]?.ready)
    await applyMessageImageLifecycleGrants(client, role);
  const recovery = await client.query(
    "SELECT to_regclass('treido.billing_recovery_requests') IS NOT NULL AS ready",
  );
  if (recovery.rows[0]?.ready) await applyBillingRecoveryGrants(client, role);
}
