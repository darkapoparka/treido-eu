/** Apply after the migration and broad runtime data grants, in the same transaction. */
export async function applySellerDeclarationReviewGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  await client.query(
    `REVOKE ALL ON treido.seller_declaration_reviews FROM "${role}"; GRANT SELECT,INSERT ON treido.seller_declaration_reviews TO "${role}"`,
  );
}
