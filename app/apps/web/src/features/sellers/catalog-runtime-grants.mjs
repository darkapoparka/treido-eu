export async function applyCatalogGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role)) throw new Error("Invalid runtime role.");
  const ready = await client.query("SELECT to_regclass('treido.seller_catalog_state') IS NOT NULL AS ready");
  if (!ready.rows[0]?.ready) return;
  const name = `"${role}"`;
  await client.query(`REVOKE UPDATE,DELETE ON treido.seller_catalog_state,treido.seller_catalog_collections,
    treido.seller_catalog_collection_items,treido.seller_catalog_product_organization,treido.seller_catalog_command_receipts FROM ${name};
    GRANT UPDATE(revision) ON treido.seller_catalog_state TO ${name};
    GRANT UPDATE(title,description,visible,archived,revision,updated_at) ON treido.seller_catalog_collections TO ${name};
    GRANT UPDATE(tags,revision,updated_at) ON treido.seller_catalog_product_organization TO ${name};
    GRANT DELETE ON treido.seller_catalog_collection_items TO ${name}`);
}
