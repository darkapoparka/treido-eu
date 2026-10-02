/** Same reviewed least-privilege data grants for isolated migrations and native QA. */
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
    position,revision,job_id,error_code,expires_at) ON treido.media_assets TO ${name}`);
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
    `REVOKE UPDATE,DELETE ON treido.listing_publications,treido.listing_publication_media FROM ${name}; GRANT EXECUTE ON FUNCTION treido.lock_publication_policy(integer,text,text,integer) TO ${name}`,
  );
}
