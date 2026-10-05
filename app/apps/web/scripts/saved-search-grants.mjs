/** Shared-owner integration helper only; no executable/apply entrypoint. */
export async function applySavedSearchGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const name = `"${role}"`;
  const tables =
    "treido.buyer_saved_search_workspaces,treido.buyer_saved_searches,treido.buyer_saved_search_versions,treido.buyer_saved_search_receipts,treido.buyer_saved_search_runs,treido.buyer_search_observations,treido.buyer_search_notifications";
  await client.query(`REVOKE ALL ON ${tables} FROM PUBLIC; REVOKE ALL ON ${tables} FROM ${name}; GRANT SELECT,INSERT ON ${tables} TO ${name};
    GRANT UPDATE(revision) ON treido.buyer_saved_search_workspaces TO ${name};
    GRANT UPDATE(name,status,criteria_version,consent_generation,frequency_minutes,consent_at,due_at,last_check_at) ON treido.buyer_saved_searches TO ${name};
    GRANT DELETE ON treido.buyer_saved_search_versions,treido.buyer_saved_search_runs,treido.buyer_search_observations,treido.buyer_search_notifications TO ${name};
    GRANT UPDATE(state,phase,position,after_listing_id,step,catalogue_pages,checked,observed) ON treido.buyer_saved_search_runs TO ${name};
    GRANT UPDATE(publication_revision,sku_id,price_minor,stock_state,eligible,change_number,observed_at) ON treido.buyer_search_observations TO ${name};
    GRANT UPDATE(read_at) ON treido.buyer_search_notifications TO ${name};
    GRANT INSERT(buyer_id) ON treido.outbox_jobs TO ${name};`);
}
