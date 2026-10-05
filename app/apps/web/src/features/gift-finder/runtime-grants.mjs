const relations = [
  "buyer_gift_workspaces",
  "buyer_gift_observations",
  "buyer_gift_receipts",
];
/** Reviewed restricted helper only; no CLI/connection/registration entrypoint. */
export async function applyGiftFinderGrants(client, role) {
  if (typeof role !== "string" || !/^[a-z_][a-z0-9_]{0,62}$/.test(role))
    throw new Error("Invalid runtime role");
  const quoted = '"' + role + '"';
  for (const relation of relations) {
    await client.query(
      `REVOKE ALL ON treido.${relation} FROM PUBLIC, ${quoted}`,
    );
    await client.query(
      `GRANT SELECT,INSERT ON treido.${relation} TO ${quoted}`,
    );
  }
  await client.query(
    `GRANT UPDATE(revision,brief,selected_ids,next_cursor,updated_at) ON treido.buyer_gift_workspaces TO ${quoted}`,
  );
  await client.query(
    `GRANT DELETE ON treido.buyer_gift_observations TO ${quoted}`,
  );
}
