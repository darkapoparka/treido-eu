/** T54 restricted feature-owned helper, no entrypoint or copied runner.
 * Call last inside the canonical owner's existing reviewed grant transaction. */
export async function applyAssistantToolsGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const name = `"${role}"`;
  await client.query(`
    REVOKE ALL ON treido.buyer_compatibility_workspaces,treido.buyer_compatibility_observations,
      treido.buyer_compatibility_receipts,treido.seller_helper_workspaces,treido.seller_helper_proposals,
      treido.seller_helper_acceptance_intents,treido.seller_helper_receipts FROM PUBLIC;
    REVOKE ALL ON treido.buyer_compatibility_workspaces,treido.buyer_compatibility_observations,
      treido.buyer_compatibility_receipts,treido.seller_helper_workspaces,treido.seller_helper_proposals,
      treido.seller_helper_acceptance_intents,treido.seller_helper_receipts FROM ${name};
    GRANT SELECT,INSERT ON treido.buyer_compatibility_workspaces,treido.buyer_compatibility_observations,
      treido.buyer_compatibility_receipts,treido.seller_helper_workspaces,treido.seller_helper_proposals,
      treido.seller_helper_acceptance_intents,treido.seller_helper_receipts TO ${name};
    GRANT UPDATE(revision,requirements,updated_at) ON treido.buyer_compatibility_workspaces TO ${name};
    GRANT UPDATE(revision) ON treido.seller_helper_workspaces TO ${name};
    GRANT DELETE ON treido.buyer_compatibility_observations,treido.seller_helper_proposals,
      treido.seller_helper_acceptance_intents TO ${name};
  `);
}
