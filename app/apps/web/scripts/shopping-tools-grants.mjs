/** T52 feature-owned integration helper. No executable entrypoint.
 * The shared owner must register the agreed additive migration and call this
 * at the END of applyRuntimeGrants inside the original reviewed transaction.
 * Source presence is not evidence of integration, grants or application. */
export async function applyShoppingToolsGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const name = `"${role}"`;
  await client.query(`
    REVOKE ALL ON treido.buyer_comparison_workspaces,treido.buyer_comparison_selections,treido.buyer_comparison_receipts FROM PUBLIC;
    REVOKE ALL ON treido.buyer_comparison_workspaces,treido.buyer_comparison_selections,treido.buyer_comparison_receipts FROM ${name};
    GRANT SELECT,INSERT ON treido.buyer_comparison_workspaces,treido.buyer_comparison_selections,treido.buyer_comparison_receipts TO ${name};
    GRANT UPDATE(revision) ON treido.buyer_comparison_workspaces TO ${name};
    GRANT UPDATE(position),DELETE ON treido.buyer_comparison_selections TO ${name};
  `);
}
