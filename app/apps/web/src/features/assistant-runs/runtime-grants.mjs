export async function applyAssistantInputGrants(client, role) {
  if (
    typeof role !== "string" ||
    !/^[a-z][a-z0-9_]{0,62}$/.test(role) ||
    ["postgres", "public"].includes(role)
  )
    throw new Error("Invalid runtime role.");
  const r = `"${role}"`;
  // The original common grant routine grants all tables first. Remove those
  // inherited direct grants before restoring this feature's exact permissions.
  await client.query(
    `REVOKE ALL ON treido.assistant_runtime_policies,treido.buyer_assistant_workspaces,treido.buyer_assistant_consents,treido.assistant_runs,treido.assistant_run_reservations,treido.buyer_assistant_receipts,treido.assistant_media_assets,treido.assistant_media_objects,treido.assistant_usage_evidence FROM ${r}`,
  );
  await client.query(
    `GRANT SELECT,UPDATE(id) ON treido.assistant_runtime_policies TO ${r}`,
  );
  await client.query(
    `GRANT SELECT,INSERT ON treido.buyer_assistant_workspaces,treido.buyer_assistant_consents,treido.assistant_runs,treido.assistant_run_reservations,treido.buyer_assistant_receipts,treido.assistant_media_assets,treido.assistant_media_objects,treido.assistant_usage_evidence TO ${r}`,
  );
  await client.query(
    `GRANT UPDATE(revision,current_run_id,current_asset_id) ON treido.buyer_assistant_workspaces TO ${r}`,
  );
  await client.query(
    `GRANT UPDATE(policy_id,revision,granted,expires_at,updated_at) ON treido.buyer_assistant_consents TO ${r}`,
  );
  await client.query(
    `GRANT UPDATE(input_json,proposal,accepted_criteria,state,provider_id,steps,emission_started_at) ON treido.assistant_runs TO ${r}`,
  );
  await client.query(
    `GRANT UPDATE(status,actual_minor) ON treido.assistant_run_reservations TO ${r}`,
  );
  await client.query(
    `GRANT UPDATE(immutable_key,ready_key,ready_checksum,ready_bytes,state) ON treido.assistant_media_assets TO ${r}`,
  );
  await client.query(
    `GRANT UPDATE(state,deletion_token,deletion_until,deleted_at) ON treido.assistant_media_objects TO ${r}`,
  );
}
